"""
Is a chat message about temporary protection in Spain?

A score, not a keyword list: one mention of "email" or "документ" is not
enough (that is how rentals, jobs and cita-selling ads got through), while
a message naming Резерв+, the ДПСУ certificate, a stamp or a sworn
translation almost certainly is. City names and procedure words add a
little; ads, rentals and jobs take a lot away.

The rules live in relevance_rules.json, shared with the server chat watch
(src/lib/chatwatch/relevance.ts), so both filter the same way.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_RULES = json.loads(Path(__file__).with_name("relevance_rules.json").read_text(encoding="utf-8"))


def _compile(stems: list[str]) -> re.Pattern:
    return re.compile(r"(?<![\w])(?:" + "|".join(stems) + ")", re.IGNORECASE | re.UNICODE)


_COMPILED = [(g["points"], _compile(g["stems"])) for g in _RULES["groups"]]
_COMPILED.append((_RULES["cityPoints"], _compile([s for stems in _RULES["cities"].values() for s in stems])))

LEVELS = {name: (v[0], v[1]) for name, v in _RULES["levels"].items()}

# What makes a message worth publishing: someone got protection or was
# refused, or was asked for something. Questions and cita-selling are not.
_BLOCK = _compile(_RULES["block"])
_OUTCOME = _compile(_RULES["outcomes"])
_REQUIREMENT = _compile(_RULES["requirements"])


def is_report(text: str) -> bool:
    """Says what happened or what was required — not a question, not an ad."""
    if _BLOCK.search(text):
        return False
    outcome = bool(_OUTCOME.search(text))
    if "?" in text and not outcome:
        return False
    return outcome or bool(_REQUIREMENT.search(text))


def score(text: str) -> tuple[int, bool, list[str]]:
    """(score, has a core term, the words that matched — for highlighting)."""
    total = 0
    core = False
    hits: list[str] = []
    for points, pattern in _COMPILED:
        found = [m.group(0) for m in pattern.finditer(text)]
        if not found:
            continue
        total += points
        if points >= 3:
            core = True
        if points > 0:
            hits.extend(found)
    return total, core, sorted(set(hits), key=len, reverse=True)


def is_relevant(text: str, level: str = "normal") -> tuple[bool, list[str]]:
    minimum, needs_core = LEVELS.get(level, LEVELS["normal"])
    total, core, hits = score(text)
    if minimum is None:
        return True, hits
    if len(text.strip()) < 20 or not is_report(text):
        return False, hits
    return total >= minimum and (core or not needs_core), hits
