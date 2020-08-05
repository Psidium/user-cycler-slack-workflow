import { extractItemAndShiftArray, prepareToSkipTheLastOne } from "../src/index";

test('can extract a item in a array', () => {
  const arr = ["1", "2", "3", "4"];
  const extracted = extractItemAndShiftArray(arr);
  expect(extracted).toBe("4");
});
test('can extract a item in a array and change the internal state', () => {
  const arr = ["1", "2", "3", "4"];
  const extracted = extractItemAndShiftArray(arr);
  expect(arr).toStrictEqual(["4", "1", "2", "3"]);
});

test('can undo an extraction and shift the last two items', () => {
  const arr = ["1", "2", "3", "4"];
  extractItemAndShiftArray(arr);
  prepareToSkipTheLastOne(arr);
  expect(arr).toStrictEqual(["1", "2", "4", "3"]);
});

test('can skip an item in the array', () => {
  const arr = ["1", "2", "3", "4"];
  extractItemAndShiftArray(arr);
  prepareToSkipTheLastOne(arr);
  const result = extractItemAndShiftArray(arr);
  expect(result).toBe("3");
});

test('can skip two items in the array', () => {
  const arr = ["1", "2", "3", "4"];
  extractItemAndShiftArray(arr);
  prepareToSkipTheLastOne(arr);
  extractItemAndShiftArray(arr);
  prepareToSkipTheLastOne(arr);
  const result = extractItemAndShiftArray(arr);
  expect(result).toBe("2");
});
