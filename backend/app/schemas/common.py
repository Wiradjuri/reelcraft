from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class Page[T](APIModel):
    items: list[T]
    total: int
    limit: int
    offset: int


def _clean_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        item = value.strip()
        if item and item.lower() not in seen:
            seen.add(item.lower())
            result.append(item)
    return result


# A short list of short strings (pillars, values, words…), de-duplicated and trimmed.
TagList = Annotated[list[Annotated[str, Field(max_length=120)]], Field(max_length=40), AfterValidator(_clean_list)]
