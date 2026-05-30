import asyncio
import httpx
import json

async def main():
    print("Testing SSE stream...")
    # Read a sample image
    try:
        with open("engine/manga-image-translator/front/docs/img/no_image.png", "rb") as f:
            img_data = f.read()
    except Exception as e:
        print("Failed to read image:", e)
        return

    files = {
        'image': ('no_image.png', img_data, 'image/png')
    }
    data = {
        'source_lang': 'ENG',
        'profile_name': 'default'
    }

    async with httpx.AsyncClient() as client:
        try:
            print("Sending POST request to http://127.0.0.1:8745/translate/stream...")
            async with client.stream("POST", "http://127.0.0.1:8745/translate/stream", data=data, files=files, timeout=60.0) as response:
                print(f"Status: {response.status_code}")
                async for line in response.aiter_lines():
                    if line:
                        print(f"RECEIVED LINE: {line}")
        except Exception as e:
            print("Error during stream:", e)

if __name__ == "__main__":
    asyncio.run(main())
