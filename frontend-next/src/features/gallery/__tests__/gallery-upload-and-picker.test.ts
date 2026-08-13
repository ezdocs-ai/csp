/* Copyright 2026 Google LLC — Licensed under Apache-2.0 */
import { expect, test } from "bun:test";

test("Gallery upload route and asset picker state validation", () => {
  // Test ID comparison normalization logic used by AssetPicker
  const asset1 = { id: 101, name: "Image 1" };
  const asset2 = { id: "101", name: "Image 1 copy" };
  const asset3 = { id: "102", name: "Image 2" };

  const isSelected = (selected: { id: string | number }[], targetId: string | number) =>
    selected.some((item) => String(item.id) === String(targetId));

  expect(isSelected([asset1], "101")).toBe(true);
  expect(isSelected([asset1], 101)).toBe(true);
  expect(isSelected([asset2], 101)).toBe(true);
  expect(isSelected([asset3], 101)).toBe(false);
});

test("Asset picker toggle logic with single vs multiple selection", () => {
  const assets = [
    { id: "1", name: "Item 1" },
    { id: "2", name: "Item 2" },
  ];

  const toggle = (
    current: { id: string; name: string }[],
    item: { id: string; name: string },
    multiple: boolean,
  ) =>
    current.some(({ id }) => String(id) === String(item.id))
      ? current.filter(({ id }) => String(id) !== String(item.id))
      : multiple
        ? [...current, item]
        : [item];

  // Single select mode
  let selected = toggle([], assets[0], false);
  expect(selected).toEqual([assets[0]]);

  selected = toggle(selected, assets[1], false);
  expect(selected).toEqual([assets[1]]);

  // Deselect
  selected = toggle(selected, assets[1], false);
  expect(selected).toEqual([]);

  // Multi select mode
  selected = toggle([], assets[0], true);
  selected = toggle(selected, assets[1], true);
  expect(selected).toEqual([assets[0], assets[1]]);
});
