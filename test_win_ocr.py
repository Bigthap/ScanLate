import io
import asyncio
from PIL import Image

try:
    from winsdk.windows.media.ocr import OcrEngine
    from winsdk.windows.graphics.imaging import BitmapDecoder
    from winsdk.windows.storage.streams import DataWriter, InMemoryRandomAccessStream
    from winsdk.windows.globalization import Language
    WIN_OCR_AVAILABLE = True
except ImportError as e:
    WIN_OCR_AVAILABLE = False
    print("winsdk missing:", e)

async def main():
    if not WIN_OCR_AVAILABLE:
        print("Not available")
        return
        
    img = Image.new("RGB", (200, 50), "white")
    language = Language("en-US")
    
    if not OcrEngine.is_language_supported(language):
        print("Lang not supported")
        
    engine = OcrEngine.try_create_from_language(language)
    if not engine:
        print("No engine")
        return
        
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    bmp_bytes = buf.getvalue()
    
    stream = InMemoryRandomAccessStream()
    writer = DataWriter(stream)
    writer.write_bytes(bmp_bytes)
    await writer.store_async()
    stream.seek(0)
    
    decoder = await BitmapDecoder.create_async(stream)
    software_bitmap = await decoder.get_software_bitmap_async()
    
    result = await engine.recognize_async(software_bitmap)
    print("OCR Result:", result.text)

if __name__ == "__main__":
    asyncio.run(main())
