from __future__ import annotations

import math
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 22_050
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "common" / "audio"


def envelope(position: float, duration: float, attack: float = 0.02, release: float = 0.12) -> float:
    return min(1.0, position / attack, max(0.0, (duration - position) / release))


def write_wave(path: Path, samples: list[float]) -> None:
    peak = max(1.0, max(abs(sample) for sample in samples))
    packed = b"".join(
        struct.pack("<h", round(max(-1.0, min(1.0, sample / peak)) * 32767))
        for sample in samples
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(packed)


def render_tone(
    duration: float,
    notes: list[tuple[float, float, float, float]],
    master: float = 0.25,
) -> list[float]:
    samples = [0.0] * round(duration * SAMPLE_RATE)
    for start, note_duration, frequency, volume in notes:
        start_index = round(start * SAMPLE_RATE)
        end_index = min(len(samples), round((start + note_duration) * SAMPLE_RATE))
        for index in range(start_index, end_index):
            position = index / SAMPLE_RATE - start
            env = envelope(position, note_duration)
            phase = 2 * math.pi * frequency * position
            tone = math.sin(phase) + 0.22 * math.sin(phase * 2) + 0.08 * math.sin(phase * 3)
            samples[index] += tone * env * volume * master
    return samples


def build_warning() -> list[float]:
    return render_tone(0.42, [(0.0, 0.16, 880.0, 0.65), (0.22, 0.16, 1046.5, 0.72)], master=0.46)


def build_caught() -> list[float]:
    notes = [(0.0, 0.24, 392.0, 0.6), (0.2, 0.28, 293.66, 0.7), (0.44, 0.38, 196.0, 0.8)]
    return render_tone(0.86, notes, master=0.46)


def build_win() -> list[float]:
    notes = [
        (0.0, 0.28, 523.25, 0.55),
        (0.18, 0.28, 659.25, 0.6),
        (0.36, 0.28, 783.99, 0.65),
        (0.56, 0.66, 1046.5, 0.72),
    ]
    return render_tone(1.28, notes, master=0.48)


def main() -> None:
    files = {
        "sfx_warning.wav": build_warning(),
        "sfx_caught.wav": build_caught(),
        "sfx_win.wav": build_win(),
    }
    for filename, samples in files.items():
        write_wave(OUTPUT_DIR / filename, samples)
        print(OUTPUT_DIR / filename)


if __name__ == "__main__":
    main()
