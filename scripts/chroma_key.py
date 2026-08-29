from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


def clamp_byte(value: float) -> int:
    return max(0, min(255, round(value)))


def build_key_mask(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    strong = Image.new("L", rgb.size)
    soft = Image.new("L", rgb.size)
    strong_pixels: list[int] = []
    soft_pixels: list[int] = []

    for red, green, blue in rgb.get_flattened_data():
        dominance = green - max(red, blue)
        strong_pixels.append(255 if green >= 28 and dominance >= 18 else 0)
        soft_pixels.append(clamp_byte((dominance - 3) / 18 * 255) if green >= 12 else 0)

    strong.putdata(strong_pixels)
    soft.putdata(soft_pixels)
    expanded = strong.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.65))

    combined = Image.new("L", rgb.size)
    combined.putdata([
        max(a, b)
        for a, b in zip(expanded.get_flattened_data(), soft.get_flattened_data())
    ])
    return combined


def remove_green(input_path: Path, output_path: Path) -> None:
    source = Image.open(input_path).convert("RGBA")
    key_mask = build_key_mask(source)
    alpha = key_mask.point(lambda value: 255 - value)

    cleaned_pixels: list[tuple[int, int, int, int]] = []
    for (red, green, blue, _), opacity in zip(
        source.get_flattened_data(), alpha.get_flattened_data()
    ):
        if opacity < 255:
            green = min(green, max(red, blue) + 8)
        cleaned_pixels.append((red, green, blue, opacity))

    result = Image.new("RGBA", source.size)
    result.putdata(cleaned_pixels)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG", optimize=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Class Break chroma-green art to RGBA PNG.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    remove_green(arguments.input, arguments.output)
