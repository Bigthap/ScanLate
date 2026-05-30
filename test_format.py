content = """# Series Profile: Magic Academy's Genius Blinker

## ข้อมูลเบื้องต้น
- **ชื่อมังงะ (ไทย)**: Template Name
- **ชื่อมังงะ (ญี่ปุ่น/เกาหลี)**: Template Name Raw
- **โทนเรื่อง**: ตลก / แอคชั่น / แฟนตาซี

## รายชื่อตัวละครและสรรพนาม
| ชื่อต้นฉบับ | ชื่อไทย | สรรพนาม (พูดแทนตัว) | สรรพนาม (เรียกคนอื่น) | รายละเอียดบุคลิก |
|---|---|---|---|---|
| ルフィ | ลูฟี่ | ฉัน | นาย | เป็นมิตร เสียงดัง รักการผจญภัย |
| ゾロ | โซโร | ฉัน | แก | เงียบขรึม พูดจาห้วนๆ |

## คลังคำศัพท์เฉพาะ (Glossary)
| คำศัพท์ต้นฉบับ | คำแปลภาษาไทย | รายละเอียด/บริบท |
|---|---|---|
| 海賊王 | ราชาโจรสลัด | ตำแหน่งสูงสุดของโจรสลัด |
| 悪魔の実 | ผลปีศาจ | ผลไม้ที่กินแล้วได้พลังวิเศษ |

| LEAFSKY | LEAFSKY | Character name or unique term. |
| RUE | RUE | Character name. |
| MAGIC ACADEMY | สถาบันเวทมนตร์ | Location. |

## กฎการแปลเพิ่มเติม
- แปลข้อความเอฟเฟกต์ (SFX) ให้กระชับ เช่น "ตูม!" แทนเสียงระเบิด
- หลีกเลี่ยงภาษาไทยที่ดูทางการเกินไป ใช้ภาษาพูดที่เป็นธรรมชาติ"""

lines = content.splitlines()

# Fix broken tables by removing empty lines within the glossary section
cleaned_lines = []
in_glossary = False
for line in lines:
    if line.startswith("## คลังคำศัพท์เฉพาะ"):
        in_glossary = True
        cleaned_lines.append(line)
    elif in_glossary and line.startswith("## "):
        in_glossary = False
        # Ensure blank line before next section
        if cleaned_lines and cleaned_lines[-1].strip() != "":
            cleaned_lines.append("")
        cleaned_lines.append(line)
    elif in_glossary:
        if line.strip() != "":
            cleaned_lines.append(line)
    else:
        cleaned_lines.append(line)
        
lines = cleaned_lines

# Find insertion point
insert_idx = len(lines)
for i in range(len(lines)):
    if lines[i].startswith("## คลังคำศัพท์เฉพาะ"):
        for j in range(i + 1, len(lines)):
            if lines[j].startswith("## "):
                if lines[j-1] == "":
                    insert_idx = j - 1
                else:
                    insert_idx = j
                break
        break

new_rows = [
    "| TEST | เทส | บริบท |"
]

lines[insert_idx:insert_idx] = new_rows

print("\n".join(lines))
