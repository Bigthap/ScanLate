import math
from PIL import Image, ImageDraw

# Create a dummy image
img = Image.new("RGB", (800, 600), "white")
draw = ImageDraw.Draw(img)
draw.rectangle([100, 100, 200, 200], fill="blue")
draw.rectangle([300, 100, 400, 200], fill="green")

regions = [
    {"minX": 100, "minY": 100, "maxX": 200, "maxY": 200},
    {"minX": 300, "minY": 100, "maxX": 400, "maxY": 200}
]

crops = []
max_w = 0
max_h = 0
for r in regions:
    bbox = (r["minX"], r["minY"], r["maxX"], r["maxY"])
    c = img.crop(bbox)
    crops.append(c)
    max_w = max(max_w, c.width)
    max_h = max(max_h, c.height)

cols = math.ceil(math.sqrt(len(crops)))
rows = math.ceil(len(crops) / cols) if cols > 0 else 1
padding_top = 20
cell_w = max_w
cell_h = max_h + padding_top

grid_img = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
draw = ImageDraw.Draw(grid_img)

for i, c in enumerate(crops):
    col = i % cols
    row = i // cols
    x = col * cell_w
    y = row * cell_h
    
    draw.rectangle([x, y, x + 30, y + 20], fill="red")
    draw.text((x + 2, y + 2), f"#{i}", fill="white")
    grid_img.paste(c, (x, y + padding_top))

grid_img.save("grid_test.jpg")
