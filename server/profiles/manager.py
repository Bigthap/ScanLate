import os
import asyncio
import hashlib
import logging
from typing import List
from server import config

logger = logging.getLogger("ScanLate-Profiles")

# Per-profile async locks to prevent concurrent write races
_profile_locks: dict[str, asyncio.Lock] = {}
_locks_meta_lock = asyncio.Lock()

async def _get_profile_lock(name: str) -> asyncio.Lock:
    async with _locks_meta_lock:
        if name not in _profile_locks:
            _profile_locks[name] = asyncio.Lock()
        return _profile_locks[name]

class ProfileManager:
    def __init__(self):
        self.profiles_dir = config.PROFILES_DIR
        self._ensure_template()

    def _ensure_template(self):
        template_path = os.path.join(self.profiles_dir, "_template.md")
        if not os.path.exists(template_path):
            template_content = """# Series Profile: _template_name

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

## กฎการแปลเพิ่มเติม
- แปลข้อความเอฟเฟกต์ (SFX) ให้กระชับ เช่น "ตูม!" แทนเสียงระเบิด
- หลีกเลี่ยงภาษาไทยที่ดูทางการเกินไป ใช้ภาษาพูดที่เป็นธรรมชาติ
"""
            try:
                with open(template_path, "w", encoding="utf-8") as f:
                    f.write(template_content)
            except Exception as e:
                logger.error(f"Failed to create profile template: {e}")

    def list_profiles(self) -> List[str]:
        """Lists all profiles by scanning filenames in the profiles directory."""
        profiles = []
        try:
            if os.path.exists(self.profiles_dir):
                for filename in os.listdir(self.profiles_dir):
                    if filename.endswith(".md") and not filename.startswith("_"):
                        profiles.append(os.path.splitext(filename)[0])
        except Exception as e:
            logger.error(f"Error listing profiles: {e}")
        return profiles

    def get_auto_profiles(self) -> List[str]:
        """Returns profiles that have been auto-updated by Auto Glossary."""
        marker_path = os.path.join(self.profiles_dir, "_auto_glossary_profiles.txt")
        if not os.path.exists(marker_path):
            return []
        try:
            with open(marker_path, "r", encoding="utf-8") as f:
                return [line.strip() for line in f if line.strip()]
        except Exception:
            return []

    def _mark_as_auto_profile(self, name: str):
        """Marks a profile as auto-updated."""
        marker_path = os.path.join(self.profiles_dir, "_auto_glossary_profiles.txt")
        existing = set(self.get_auto_profiles())
        existing.add(name)
        try:
            with open(marker_path, "w", encoding="utf-8") as f:
                f.write("\n".join(sorted(existing)))
        except Exception as e:
            logger.error(f"Failed to update auto profile marker: {e}")

    def get_profile_path(self, name: str) -> str:
        # Prevent directory traversal attacks
        safe_name = os.path.basename(name) + ".md"
        return os.path.join(self.profiles_dir, safe_name)

    def get_profile_content(self, name: str) -> str:
        """Reads profile markdown content to feed to LLM."""
        path = self.get_profile_path(name)
        if not os.path.exists(path):
            logger.warning(f"Profile {name} not found. Returning template.")
            template_path = os.path.join(self.profiles_dir, "_template.md")
            if os.path.exists(template_path):
                with open(template_path, "r", encoding="utf-8") as f:
                    return f.read()
            return "ไม่มีข้อมูล Series Profile"
            
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading profile {name}: {e}")
            return "ไม่สามารถอ่านข้อมูล Series Profile ได้"

    def get_profile_hash(self, name: str) -> str:
        """Returns SHA256 of the profile content to detect changes for caching."""
        content = self.get_profile_content(name)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def get_glossary_terms(self, name: str) -> List[dict]:
        """Parses and returns all glossary entries from the profile as a list of dicts."""
        content = self.get_profile_content(name)
        terms = []
        in_glossary = False
        for line in content.splitlines():
            if line.startswith("## คลังคำศัพท์เฉพาะ"):
                in_glossary = True
                continue
            if in_glossary and line.startswith("## "):
                break
            if in_glossary and line.startswith("|"):
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 4 and parts[1] and parts[1] not in ("คำศัพท์ต้นฉบับ", "---", ""):
                    terms.append({
                        "term": parts[1],
                        "translation": parts[2],
                        "context": parts[3] if len(parts) > 3 else ""
                    })
        return terms

    def get_relevant_glossary(self, name: str, ocr_texts: List[str]) -> List[dict]:
        """Returns only glossary terms whose 'term' appears in the given OCR text list.
        Falls back to full glossary if nothing matches (e.g., first page of a new chapter).
        """
        all_terms = self.get_glossary_terms(name)
        if not all_terms:
            return []

        combined_text = " ".join(ocr_texts).lower()
        relevant = [t for t in all_terms if t["term"].lower() in combined_text]

        # If nothing matches, still inject up to 30 most-recent terms so context isn't lost
        if not relevant:
            return all_terms[-30:]
        return relevant

    def create_profile(self, name: str, content: str = None) -> bool:
        """Creates a new profile. If content is empty, initializes with template."""
        path = self.get_profile_path(name)
        if os.path.exists(path):
            logger.warning(f"Profile {name} already exists.")
            return False
            
        try:
            if not content:
                template_path = os.path.join(self.profiles_dir, "_template.md")
                if os.path.exists(template_path):
                    with open(template_path, "r", encoding="utf-8") as f:
                        content = f.read().replace("_template_name", name)
                else:
                    content = f"# Series Profile: {name}\n"
                    
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Created new profile: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to create profile {name}: {e}")
            return False

    def update_profile(self, name: str, content: str) -> bool:
        """Updates the content of an existing profile."""
        path = self.get_profile_path(name)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Updated profile: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to update profile {name}: {e}")
            return False

    async def append_glossary_terms(self, name: str, new_terms: List[dict]) -> bool:
        """Appends new terms to the glossary table in the profile, deduplicating.
        Uses an async per-profile lock to prevent concurrent write races.
        """
        if not new_terms:
            return True

        lock = await _get_profile_lock(name)
        async with lock:
            content = self.get_profile_content(name)
            
            # Build set of existing terms in glossary for deduplication
            existing_terms = set()
            for line in content.splitlines():
                if line.startswith("|") and "|" in line[1:]:
                    parts = [p.strip() for p in line.split("|")]
                    if len(parts) >= 2 and parts[1] and parts[1] not in ("คำศัพท์ต้นฉบับ", "---"):
                        existing_terms.add(parts[1].lower())
            
            # Filter out terms that already exist
            filtered_terms = [
                t for t in new_terms
                if t.get("term", "").lower() not in existing_terms and t.get("term", "")
            ]
            if not filtered_terms:
                logger.info(f"Auto Glossary: No new unique terms for profile '{name}'. Skipping.")
                return True

            # Find the glossary section — create it if missing
            glossary_header = "## คลังคำศัพท์เฉพาะ (Glossary)"
            if glossary_header not in content:
                content += f"\n\n{glossary_header}\n| คำศัพท์ต้นฉบับ | คำแปลภาษาไทย | รายละเอียด/บริบท |\n|---|---|---|\n"
            
            lines = content.splitlines()
            
            # Clean up empty lines within the glossary table block
            cleaned_lines = []
            in_glossary = False
            for line in lines:
                if line.startswith("## คลังคำศัพท์เฉพาะ"):
                    in_glossary = True
                    cleaned_lines.append(line)
                elif in_glossary and line.startswith("## "):
                    in_glossary = False
                    if cleaned_lines and cleaned_lines[-1].strip() != "":
                        cleaned_lines.append("")
                    cleaned_lines.append(line)
                elif in_glossary:
                    if line.strip() != "":
                        cleaned_lines.append(line)
                else:
                    cleaned_lines.append(line)
                    
            lines = cleaned_lines
            
            # Find insertion point (end of glossary table)
            insert_idx = len(lines)
            for i in range(len(lines)):
                if lines[i].startswith("## คลังคำศัพท์เฉพาะ"):
                    for j in range(i + 1, len(lines)):
                        if lines[j].startswith("## "):
                            insert_idx = j - 1 if lines[j-1] == "" else j
                            break
                    break
                    
            # Prepare the new markdown rows
            new_rows = []
            for term in filtered_terms:
                t   = term.get("term", "").replace("\n", " ").strip()
                tr  = term.get("translation", "").replace("\n", " ").strip()
                ctx = term.get("context", "").replace("\n", " ").strip()
                new_rows.append(f"| {t} | {tr} | {ctx} |")
                
            # Insert rows and write back
            lines[insert_idx:insert_idx] = new_rows
            
            logger.info(f"Auto Glossary: Added {len(filtered_terms)} new terms to profile '{name}'.")
            self._mark_as_auto_profile(name)
            # FIX: was `new_lines` (NameError) — correct variable is `lines`
            return self.update_profile(name, "\n".join(lines))

# Global instance
_manager = None
def get_profile_manager() -> ProfileManager:
    global _manager
    if _manager is None:
        _manager = ProfileManager()
    return _manager
