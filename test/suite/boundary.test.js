/** @type {typeof import("assert")} */
const assert = require("assert").strict;
const vscode = require("vscode");
const path = require("path");
const vscodeUtil = require("../../src/vscodeUtil.js");
const boundary = require("../../src/boundary.js");

const BOUNDARY01 = [
  [b("Ll", 0, 3), b("CCL", 3, 6), b("Lu", 9, 3), b("Ll", 12, 3), b("EOL", 15, 0)],
  [b("Ll", 0, 3), b("Nd", 3, 4), b("CCL", 7, 3), b("Ps", 10, 1), b("Pe", 11, 1), b("EOL", 12, 0)],
  [
    b("SPC", 0, 1),
    b("SPC", 1, 1),
    b("Ll", 2, 3),
    b("Ps", 5, 1),
    b("Pe", 6, 1),
    b("Zs", 7, 2),
    b("CCL", 9, 3),
    b("Zs", 12, 2),
    b("Ll", 14, 3),
    b("Zs", 17, 2),
    b("Lu", 19, 3),
    b("Zs", 22, 2),
    b("Ll", 24, 3),
    b("EOL", 27, 0),
  ],
  [b("EOL", 0, 0)],
];
const BOUNDARY_MOVETEST = [
  [b("Ll", 0, 2), b("Nd", 2, 2), b("Ll", 4, 2), b("Nd", 6, 2), b("Ll", 8, 2), b("Nd", 10, 2), b("EOL", 12, 0)],
  [b("Ll", 0, 2), b("Nd", 2, 2), b("Ll", 4, 2), b("Nd", 6, 2), b("Ll", 8, 2), b("Nd", 10, 2), b("EOL", 12, 0)],
  [b("Ll", 0, 2), b("Nd", 2, 2), b("Ll", 4, 2), b("Nd", 6, 2), b("Ll", 8, 2), b("Nd", 10, 2), b("EOL", 12, 0)],
];

// testData/decorationRange.txt
const LINE_DECORATION_RANGES = [
  d(0, 0, 3, 0, 0),
  d(0, 4, 7, 1, 2),
  d(0, 8, 11, 2, 4),
  d(0, 12, 15, 3, 6),
  d(0, 15, 15, 4, 7),
];
const DECORATION_RANGES = [
  LINE_DECORATION_RANGES,
  [d(1, 0, 3, 0, 0), d(1, 4, 7, 1, 2), d(1, 8, 11, 2, 4), d(1, 12, 15, 3, 6), d(1, 15, 15, 4, 7)],
];

const ROOT_URI = vscode.workspace.workspaceFolders[0].uri;
const CONFIG_DEFAULT_DB = {
  SpecialCharacters: "\"'`",
  CapitalLetter: true,
  Japanese: false,
};

const CONFIG_DEFAULT_BM = {
  SpecialCharacters: "\"'`",
  CapitalLetter: true,
  Japanese: false,
  MarkerMargin: "0ex 0.3ex 0ex 0.7ex",
};

function b(shortValue, start, length) {
  return boundary.DocumentBoundary.getBoundary(shortValue, start, length);
}
function s(string, start) {
  return { string, start };
}
function p(line, character) {
  return { line, character };
}
function d(lineIndex, anchor, active, count, index) {
  return {
    range: new vscode.Range(lineIndex, anchor, lineIndex, active),
    textContent: vscodeUtil.convertToString(lineIndex) + vscodeUtil.convertToString(count),
    lineIndex,
    index,
  };
}

function positionAssert(actual, expected) {
  for (let i = 0; i < actual.length; i++) {
    assert.deepStrictEqual(actual[i], expected[i]);
  }
}

async function prepare1(fileName, config = CONFIG_DEFAULT_DB) {
  const document = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, fileName));
  const editor = await vscode.window.showTextDocument(document);
  const db = new boundary.DocumentBoundary(document, config);
  return { db, document, editor };
}

const currentConfig = {
  SpecialCharacters: "\"'`",
  CapitalLetter: true,
  Japanese: false,
  MarkerMargin: "0ex 0.3ex 0ex 0.7ex",
};

function getConfig(wsConfig, config) {
  config.SpecialCharacters = wsConfig.get("specialCharacters");
  config.CapitalLetter = wsConfig.get("capitalLetter");
  config.Japanese = wsConfig.get("japanese");
  config.MarkerMargin = wsConfig.get("markerMargin");
}
async function setConfig(wsConfig, config) {
  await wsConfig.update("specialCharacters", config.SpecialCharacters);
  await wsConfig.update("capitalLetter", config.CapitalLetter);
  await wsConfig.update("japanese", config.Japanese);
  await wsConfig.update("markerMargin", config.MarkerMargin);
}

async function prepare2(fileName) {
  //const folder = vscode.workspace.workspaceFolders[0];
  const wsConfig = vscode.workspace.getConfiguration("boundaryMove"); // 本当は初期値に設定しなければならない
  const channel = vscode.window.createOutputChannel("Test");
  const bm = new boundary.BoundaryManager(channel, wsConfig);
  const document = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, fileName));
  const editor = await vscode.window.showTextDocument(document);
  return { bm, channel, config: wsConfig, document, editor };
}

let document = null;
let editor = null;
let config = null;
let db = null;
let bm = null;
let channel = null;

describe("UnicodeBoundary Test", function () {
  //this.timeout(0);

  before(async function () {
    ({ db, document, editor } = await prepare1("boundary01.txt"));
  });

  describe("DocumentBoundary", function () {
    describe("getBoundary", function () {
      it("test", function () {
        const result = boundary.DocumentBoundary.getBoundary("shortValue", 0, 1);
        assert.deepStrictEqual(result, { shortValue: "shortValue", start: 0, length: 1 });
      });
    });

    describe("escape", function () {
      it("no escape", function () {
        const string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !\"#$%&'()=~|@`{};+:*<,>./?_";
        const result = boundary.DocumentBoundary.escape(string);
        assert.deepStrictEqual(result, string);
      });
      it("escape", function () {
        const string = "[]^-\\";
        const result = boundary.DocumentBoundary.escape(string);
        const expect = "\\[\\]\\^\\-\\\\";
        assert.deepStrictEqual(result, expect);
      });
    });

    describe("compile", function () {
      it("test", function () {
        const specialCharacters = "\"'`";
        const result = boundary.DocumentBoundary.compile(specialCharacters);
        assert.deepStrictEqual(result, {
          shortValue: "SPC",
          longValue: "SpecialCharacters",
          regex: new RegExp("[\"'`]", "gu"),
        });
      });
    });

    describe("setConfig", function () {
      it("test", function () {
        config = {
          SpecialCharacters: "abc",
          CapitalLetter: false,
          Japanese: false,
        };
        db.setConfig(config);
        assert.deepStrictEqual(db.SpecialRegex, {
          shortValue: "SPC",
          longValue: "SpecialCharacters",
          regex: new RegExp("[abc]", "gu"),
        });
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);

        config = {
          SpecialCharacters: "012",
          CapitalLetter: true,
          Japanese: true,
        };
        db.setConfig(config);
        assert.deepStrictEqual(db.SpecialRegex, {
          shortValue: "SPC",
          longValue: "SpecialCharacters",
          regex: new RegExp("[012]", "gu"),
        });
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
      });
    });

    describe("sorter", function () {
      it("test", function () {
        const x = b("", 0, 0);
        const y = b("", 1, 0);
        const z = b("", 2, 0);
        assert.strictEqual(boundary.DocumentBoundary.sorter(y, x), 1);
        assert.strictEqual(boundary.DocumentBoundary.sorter(y, y), 0);
        assert.strictEqual(boundary.DocumentBoundary.sorter(y, z), -1);
      });
    });

    describe("scan", function () {
      it("test", function () {
        const string = "function func(){";
        const result = boundary.DocumentBoundary.scan(string, boundary.DocumentBoundary.GeneralCategory, 0, false);
        result.sort(boundary.DocumentBoundary.sorter);
        assert.deepStrictEqual(result, [
          b("Ll", 0, 8),
          b("Zs", 8, 1),
          b("Ll", 9, 4),
          b("Ps", 13, 1),
          b("Pe", 14, 1),
          b("Ps", 15, 1),
        ]);
      });
    });

    describe("getRestStrings", function () {
      it("test", function () {
        const string = "function func(){";
        const result = boundary.DocumentBoundary.getRestStrings(string, [b("", 8, 1), b("", 13, 2)]);
        assert.deepStrictEqual(result, [s("function", 0), s("func", 9), s("{", 15)]);
      });
    });

    describe("scanSpecialCharacter", function () {
      it("test", function () {
        const string = "'abc', '', '012'";
        const specialCharacters = "'";
        const specialRegex = boundary.DocumentBoundary.compile(specialCharacters);
        const result = boundary.DocumentBoundary.scanSpecialCharacter(string, specialRegex);
        assert.deepStrictEqual(result, {
          boundaries: [
            b("SPC", 0, 1),
            b("SPC", 4, 1),
            b("SPC", 7, 1),
            b("SPC", 8, 1),
            b("SPC", 11, 1),
            b("SPC", 15, 1),
          ],
          stringInfos: [s("abc", 1), s(", ", 5), s(", ", 9), s("012", 12)],
        });
      });
    });

    describe("capitalLetter", function () {
      it("test", function () {
        const boundaries = [b("Lu", 0, 1), b("Ll", 1, 2), b("Lu", 3, 2), b("Ll", 5, 2), b("Lu", 7, 1), b("Zs", 8, 1)];
        const expected = [b("CCL", 0, 3), b("Lu", 3, 2), b("Ll", 5, 2), b("Lu", 7, 1), b("Zs", 8, 1)];
        const result = boundary.DocumentBoundary.capitalLetter(boundaries);
        assert.deepStrictEqual(result, expected);
      });
    });

    describe("scanLine", function () {
      it("test", function () {
        const line = "I like Cat.";
        const expected = [
          b("Lu", 0, 1),
          b("Zs", 1, 1),
          b("Ll", 2, 4),
          b("Zs", 6, 1),
          b("CCL", 7, 3),
          b("Po", 10, 1),
          b("EOL", 11, 0),
        ];
        const result = db.scanLine(line);
        assert.deepStrictEqual(result, expected);
      });
    });

    describe("scanAll", function () {
      it("test", async function () {
        ({ db, document, editor } = await prepare1("scanAll.js"));
        const expected = [
          [
            b("Ll", 0, 8),
            b("Zs", 8, 1),
            b("Ll", 9, 4),
            b("Nd", 13, 1),
            b("Ps", 14, 1),
            b("Pe", 15, 1),
            b("Zs", 16, 1),
            b("Ps", 17, 1),
            b("EOL", 18, 0),
          ],
          [
            b("Zs", 0, 2),
            b("Ll", 2, 6),
            b("Zs", 8, 1),
            b("SPC", 9, 1),
            b("SPC", 10, 1),
            b("Po", 11, 1),
            b("EOL", 12, 0),
          ],
          [b("Pe", 0, 1), b("EOL", 1, 0)],
          [b("EOL", 0, 0)],
        ];
        const result = db.scanAll(document);
        assert.deepStrictEqual(result, expected);
      });
    });

    describe("compareGt", function () {
      it("test", function () {
        const x = 0;
        const y = 1;
        const z = 2;
        let [left, right] = [0, 10];
        let result = boundary.DocumentBoundary.compareGt(x, y, 5, left, right);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compareGt(y, y, 5, left, right);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compareGt(z, y, 5, left, right);
        assert.deepStrictEqual(result, [0, 5]);

        [left, right] = [0, 1];
        result = boundary.DocumentBoundary.compareGt(z, y, 0, left, right);
        assert.deepStrictEqual(result, []);
      });
    });

    describe("compareLt", function () {
      it("test", function () {
        const x = 0;
        const y = 1;
        const z = 2;
        let [left, right] = [0, 10];
        let result = boundary.DocumentBoundary.compareLt(x, y, 5, left, right);
        assert.deepStrictEqual(result, [5, 10]);

        result = boundary.DocumentBoundary.compareLt(y, y, 5, left, right);
        assert.deepStrictEqual(result, [0, 4]);

        result = boundary.DocumentBoundary.compareLt(z, y, 5, left, right);
        assert.deepStrictEqual(result, [0, 4]);

        [left, right] = [0, 1];
        result = boundary.DocumentBoundary.compareLt(x, y, 5, left, right);
        assert.deepStrictEqual(result, []);
      });
    });

    describe("compareEq", function () {
      it("test", function () {
        const x = 0;
        const y = 1;
        const z = 2;
        let [left, right] = [0, 10];
        let result = boundary.DocumentBoundary.compareEq(x, y, 5, left, right);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compareEq(y, y, 5, left, right);
        assert.deepStrictEqual(result, [5]);

        result = boundary.DocumentBoundary.compareEq(z, y, 5, left, right);
        assert.deepStrictEqual(result, [0, 4]);
      });
    });

    describe("compare", function () {
      const x = b("", 0, 0);
      const y = b("", 1, 0);
      const z = b("", 2, 0);

      it("gt", function () {
        let [left, right] = [0, 10];
        const type = "gt";
        let result = boundary.DocumentBoundary.compare(x, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compare(y, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compare(z, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [0, 5]);

        [left, right] = [0, 1];
        result = boundary.DocumentBoundary.compare(z, 1, 5, left, right, type);
        assert.deepStrictEqual(result, []);
      });

      it("lt", function () {
        let [left, right] = [0, 10];
        const type = "lt";
        let result = boundary.DocumentBoundary.compare(x, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [5, 10]);

        result = boundary.DocumentBoundary.compare(y, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [0, 4]);

        result = boundary.DocumentBoundary.compare(z, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [0, 4]);

        [left, right] = [0, 1];
        result = boundary.DocumentBoundary.compare(x, 1, 5, left, right, type);
        assert.deepStrictEqual(result, []);
      });

      it("eq", function () {
        let [left, right] = [0, 10];
        const type = "eq";
        let result = boundary.DocumentBoundary.compare(x, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [6, 10]);

        result = boundary.DocumentBoundary.compare(y, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [5]);

        result = boundary.DocumentBoundary.compare(z, 1, 5, left, right, type);
        assert.deepStrictEqual(result, [0, 4]);
      });
    });

    describe("getMiddle", function () {
      it("test", function () {
        let [left, right] = [0, 10];
        let result = boundary.DocumentBoundary.getMiddle(left, right, "gt");
        assert.strictEqual(result, 5);
        result = boundary.DocumentBoundary.getMiddle(left, right, "eq");
        assert.strictEqual(result, 5);
        result = boundary.DocumentBoundary.getMiddle(left, right, "lt");
        assert.strictEqual(result, 5);

        [left, right] = [1, 10];
        result = boundary.DocumentBoundary.getMiddle(left, right, "gt");
        assert.strictEqual(result, 5);
        result = boundary.DocumentBoundary.getMiddle(left, right, "eq");
        assert.strictEqual(result, 5);
        result = boundary.DocumentBoundary.getMiddle(left, right, "lt");
        assert.strictEqual(result, 6);
      });
    });

    describe("search", function () {
      const array = [b("", 0, 0), b("", 1, 0), b("", 2, 0)];
      let result = -1;
      it("gt", function () {
        result = boundary.DocumentBoundary.search(array, 1, "gt");
        assert.strictEqual(result, 2);
        result = boundary.DocumentBoundary.search(array, 2, "gt");
        assert.strictEqual(result, -1);
      });
      it("lt", function () {
        result = boundary.DocumentBoundary.search(array, 1, "lt");
        assert.strictEqual(result, 0);
        result = boundary.DocumentBoundary.search(array, 0, "lt");
        assert.strictEqual(result, -1);
      });
      it("eq", function () {
        result = boundary.DocumentBoundary.search(array, 1, "eq");
        assert.strictEqual(result, 1);
        result = boundary.DocumentBoundary.search(array, 3, "eq");
        assert.strictEqual(result, -1);
      });
    });

    describe("isSameUri", function () {
      it("test", function () {
        assert.ok(db.isSameUri(document.uri));
        assert.ok(!db.isSameUri({ path: "" }));
      });
    });

    describe("modify", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("boundary01.txt"));
      });

      it("no change", function () {
        const length = db.lineBoundaries.length;
        db.modify(0, 1);
        assert.strictEqual(db.lineBoundaries.length, length);
      });

      it("delete", function () {
        const length = db.lineBoundaries.length;
        db.modify(-1, 1);
        assert.strictEqual(db.lineBoundaries.length, length - 1);
        const expected = Array.from(BOUNDARY01);
        expected.splice(1, 1);
        assert.deepStrictEqual(db.lineBoundaries, expected);
      });

      it("add", async function () {
        const length = db.lineBoundaries.length;
        db.modify(1, 1);
        assert.strictEqual(db.lineBoundaries.length, length + 1);
        const expected = Array.from(BOUNDARY01);
        expected.splice(1, 0, ...new Array(1));
        assert.deepStrictEqual(db.lineBoundaries, expected);
      });
    });

    describe("changeLine", function () {
      it("test", async function () {
        ({ db, document, editor } = await prepare1("boundary01.txt"));
        db.lineBoundaries = new Array(4);
        db.changeLines(document, { start: 0, end: 3 });
        assert.deepStrictEqual(db.lineBoundaries, BOUNDARY01);
      });
    });

    describe("getLineInfo", function () {
      it("test", async function () {
        ({ db, document, editor } = await prepare1("boundary01.txt"));
        const result = db.getLineInfo(document.lineAt(0).text, 0);
        assert.deepStrictEqual(result, "0: ‾abc‾Abcabc‾ABC‾abc‾");
      });
    });

    describe("getPositionsLeft", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });
      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 12, 1, 12);
        let expected = [p(1, 10)];
        let result = db.getPositionsLeft(editor);
        positionAssert(result, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 0);
        expected = [p(0, 12)];
        result = db.getPositionsLeft(editor);
        positionAssert(result, expected);
      });

      it("two selections", async function () {
        editor.selections = [new vscode.Selection(1, 12, 1, 12), new vscode.Selection(1, 0, 1, 0)];
        let expected = [p(1, 10), p(0, 12)];
        let result = db.getPositionsLeft(editor);
        positionAssert(result, expected);
      });
    });

    describe("moveLeft", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });
      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 12, 1, 12);
        let expected = new vscode.Selection(1, 10, 1, 10);
        db.moveLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 0);
        expected = new vscode.Selection(0, 12, 0, 12);
        db.moveLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);
      });
      it("two selections", async function () {
        editor.selections = [new vscode.Selection(1, 12, 1, 12), new vscode.Selection(1, 0, 1, 0)];
        const expected = [new vscode.Selection(1, 10, 1, 10), new vscode.Selection(0, 12, 0, 12)];
        db.moveLeft(editor);
        positionAssert(editor.selections, expected);
      });
    });

    describe("selectLeft", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });
      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 12, 1, 12);
        let expected = new vscode.Selection(1, 12, 1, 10);
        db.selectLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 0);
        expected = new vscode.Selection(1, 0, 0, 12);
        db.selectLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 12, 1, 10);
        expected = new vscode.Selection(1, 12, 1, 8);
        db.selectLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 10, 1, 12);
        expected = new vscode.Selection(1, 10, 1, 10);
        db.selectLeft(editor);
        assert.deepStrictEqual(editor.selection, expected);
      });
      it("selections", async function () {
        editor.selections = [
          new vscode.Selection(1, 12, 1, 12),
          new vscode.Selection(1, 0, 1, 0),
          new vscode.Selection(1, 12, 1, 10),
          new vscode.Selection(1, 10, 1, 12),
        ];
        const expected = [
          new vscode.Selection(1, 12, 1, 10),
          new vscode.Selection(1, 0, 0, 12),
          new vscode.Selection(1, 12, 1, 8),
          new vscode.Selection(1, 10, 1, 10),
        ];
        db.selectLeft(editor);
        positionAssert(editor.selections, expected);
      });
    });

    describe("getPositionsRight", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });

      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 0, 1, 0);
        let expected = [p(1, 2)];
        let result = db.getPositionsRight(editor);
        positionAssert(result, expected);

        editor.selection = new vscode.Selection(1, 12, 1, 12);
        expected = [p(2, 0)];
        result = db.getPositionsRight(editor);
        positionAssert(result, expected);
      });
      it("two selections", async function () {
        editor.selections = [new vscode.Selection(1, 12, 1, 12), new vscode.Selection(1, 0, 1, 0)];
        let expected = [p(2, 0), p(1, 2)];
        let result = db.getPositionsRight(editor);
        positionAssert(result, expected);
      });
    });

    describe("moveRight", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });

      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 0, 1, 0);
        let expected = new vscode.Selection(1, 2, 1, 2);
        db.moveRight(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 12, 1, 12);
        expected = new vscode.Selection(2, 0, 2, 0);
        db.moveRight(editor);
        assert.deepStrictEqual(editor.selection, expected);
      });
      it("two selections", async function () {
        editor.selections = [new vscode.Selection(1, 12, 1, 12), new vscode.Selection(1, 0, 1, 0)];
        const expected = [new vscode.Selection(2, 0, 2, 0), new vscode.Selection(1, 2, 1, 2)];
        db.moveRight(editor);
        positionAssert(editor.selections, expected);
      });
    });

    describe("selectRight", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });
      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 12, 1, 12);
        let expected = new vscode.Selection(1, 12, 2, 0);
        db.selectRight(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 0);
        expected = new vscode.Selection(1, 0, 1, 2);
        db.selectRight(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 2, 1, 0);
        expected = new vscode.Selection(1, 2, 1, 2);
        db.selectRight(editor);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 2);
        expected = new vscode.Selection(1, 0, 1, 4);
        db.selectRight(editor);
        assert.deepStrictEqual(editor.selection, expected);
      });
      it("selections", async function () {
        editor.selections = [
          new vscode.Selection(1, 12, 1, 12),
          new vscode.Selection(1, 0, 1, 0),
          new vscode.Selection(1, 2, 1, 0),
          new vscode.Selection(1, 0, 1, 2),
        ];
        const expected = [
          new vscode.Selection(1, 12, 2, 0),
          new vscode.Selection(1, 0, 1, 2),
          new vscode.Selection(1, 2, 1, 2),
          new vscode.Selection(1, 0, 1, 4),
        ];
        db.selectRight(editor);
        positionAssert(editor.selections, expected);
      });
    });

    describe("jump", function () {
      beforeEach(async function () {
        ({ db, document, editor } = await prepare1("moveTest.txt"));
      });
      it("one selection", async function () {
        editor.selection = new vscode.Selection(1, 0, 1, 0);
        let expected = new vscode.Selection(2, 0, 2, 0);
        db.jump(editor, 2, 0);
        assert.deepStrictEqual(editor.selection, expected);

        editor.selection = new vscode.Selection(1, 0, 1, 0);
        expected = new vscode.Selection(2, 8, 2, 8);
        db.jump(editor, 2, 4);
        assert.deepStrictEqual(editor.selection, expected);
      });
      it("selections", async function () {
        editor.selections = [
          new vscode.Selection(1, 12, 1, 12),
          new vscode.Selection(1, 0, 1, 0),
          new vscode.Selection(1, 2, 1, 0),
          new vscode.Selection(1, 0, 1, 2),
        ];
        const expected = [new vscode.Selection(0, 4, 0, 4)];
        db.jump(editor, 0, 2);
        positionAssert(editor.selections, expected);
      });
    });

    describe("constructor", function () {
      it("test", async function () {
        ({ db, document, editor } = await prepare1("boundary01.txt"));

        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, {
          shortValue: "SPC",
          longValue: "SpecialCharacters",
          regex: new RegExp("[\"'`]", "gu"),
        });
        assert.deepStrictEqual(db.CapitalLetter, CONFIG_DEFAULT_BM.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, CONFIG_DEFAULT_BM.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, BOUNDARY01);
      });
    });

    describe("CapitalLetter", function () {
      it("false", async function () {
        config = {
          SpecialCharacters: "",
          CapitalLetter: false,
          Japanese: false,
        };
        ({ db, document, editor } = await prepare1("CapitalLetter.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, null);
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [
            b("Lu", 0, 1),
            b("Ll", 1, 2),
            b("Lu", 3, 3),
            b("Ll", 6, 3),
            b("Zs", 9, 1),
            b("Lu", 10, 1),
            b("Ll", 11, 2),
            b("Zs", 13, 1),
            b("Ll", 14, 3),
            b("EOL", 17, 0),
          ],
        ]);
      });

      it("true", async function () {
        config = {
          SpecialCharacters: "",
          CapitalLetter: true,
          Japanese: false,
        };
        ({ db, document, editor } = await prepare1("CapitalLetter.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, null);
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [
            b("CCL", 0, 3),
            b("Lu", 3, 3),
            b("Ll", 6, 3),
            b("Zs", 9, 1),
            b("CCL", 10, 3),
            b("Zs", 13, 1),
            b("Ll", 14, 3),
            b("EOL", 17, 0),
          ],
        ]);
      });
    });

    describe("Japanese", function () {
      it("false", async function () {
        config = {
          SpecialCharacters: "",
          CapitalLetter: false,
          Japanese: false,
        };
        ({ db, document, editor } = await prepare1("Japanese.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, null);
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [b("Lo", 0, 2), b("Po", 2, 1), b("Lo", 3, 9), b("Po", 12, 1), b("EOL", 13, 0)],
        ]);
      });

      it("true", async function () {
        config = {
          SpecialCharacters: "",
          CapitalLetter: false,
          Japanese: true,
        };
        ({ db, document, editor } = await prepare1("Japanese.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, null);
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [
            b("Hani", 0, 1),
            b("Hira", 1, 1),
            b("Po", 2, 1),
            b("Kana", 3, 3),
            b("Hira", 6, 1),
            b("Hani", 7, 2),
            b("Hira", 9, 3),
            b("Po", 12, 1),
            b("EOL", 13, 0),
          ],
        ]);
      });
    });

    describe("SpecialCharacters", function () {
      it("empty", async function () {
        config = {
          SpecialCharacters: "",
          CapitalLetter: false,
          Japanese: false,
        };
        ({ db, document, editor } = await prepare1("SpecialCharacters.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, null);
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [
            b("Po", 0, 2),
            b("Sk", 2, 2),
            b("Po", 4, 2),
            b("Ps", 6, 2),
            b("Pe", 8, 2),
            b("Pd", 10, 2),
            b("Po", 12, 2),
            b("Sk", 14, 2),
            b("Zs", 16, 2),
            b("EOL", 18, 0),
          ],
        ]);
      });

      it("\"'`[]-\\^", async function () {
        config = {
          SpecialCharacters: "\"'`[]-\\^",
          CapitalLetter: false,
          Japanese: false,
        };
        ({ db, document, editor } = await prepare1("SpecialCharacters.txt", config));
        assert.deepStrictEqual(db.uri, document.uri);
        assert.deepStrictEqual(db.SpecialRegex, {
          shortValue: "SPC",
          longValue: "SpecialCharacters",
          regex: new RegExp(`["'\`\\[\\]\\-\\\\\\^]`, "gu"),
        });
        assert.deepStrictEqual(db.CapitalLetter, config.CapitalLetter);
        assert.deepStrictEqual(db.Japanese, config.Japanese);
        assert.deepStrictEqual(db.lineBoundaries, [
          [
            b("SPC", 0, 1),
            b("SPC", 1, 1),
            b("SPC", 2, 1),
            b("SPC", 3, 1),
            b("SPC", 4, 1),
            b("SPC", 5, 1),
            b("SPC", 6, 1),
            b("SPC", 7, 1),
            b("SPC", 8, 1),
            b("SPC", 9, 1),
            b("SPC", 10, 1),
            b("SPC", 11, 1),
            b("SPC", 12, 1),
            b("SPC", 13, 1),
            b("SPC", 14, 1),
            b("SPC", 15, 1),
            b("Zs", 16, 2),
            b("EOL", 18, 0),
          ],
        ]);
      });
    });
  });
});

describe("BoundaryManager", function () {
  this.timeout(5000);
  before(async function () {
    const wsConfig = vscode.workspace.getConfiguration("boundaryMove");
    getConfig(wsConfig, currentConfig);
    await setConfig(wsConfig, CONFIG_DEFAULT_BM);
  });
  after(async function () {
    const wsConfig = vscode.workspace.getConfiguration("boundaryMove");
    await setConfig(wsConfig, currentConfig);
  });

  describe("constructor, setConfig and getConfig", function () {
    it("test", async function () {
      ({ bm, channel, config, document, editor } = await prepare2("boundary01.txt"));
      assert.deepStrictEqual(bm.documentBoundaries.length, 0);
      assert.deepStrictEqual(bm.channel.name, channel.name);
      assert.deepStrictEqual(bm.getConfig(), CONFIG_DEFAULT_BM);
    });
  });

  describe("config", function () {
    it("test", async function () {
      this.timeout(0);
      ({ bm, channel, config, document, editor } = await prepare2("boundary01.txt"));
      bm.add(document);
      assert.deepStrictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.getConfig(), CONFIG_DEFAULT_BM);
      bm.Japanese = true;
      bm.CapitalLetter = false;
      bm.config(config);
      assert.deepStrictEqual(bm.documentBoundaries.length, 0);
      assert.deepStrictEqual(bm.getConfig(), CONFIG_DEFAULT_BM);
    });
  });

  describe("find", function () {
    it("test", async function () {
      ({ bm, channel, config, document, editor } = await prepare2("vscodeUtil1.txt"));
      const document1 = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, "vscodeUtil2.txt"));
      bm.add(document);
      let result = bm.find(document.uri);
      assert.strictEqual(result, 0);
      result = bm.find(document1.uri);
      assert.strictEqual(result, -1);
    });
  });

  describe("checkScheme", function () {
    it("test", function () {
      assert.strictEqual(boundary.BoundaryManager.checkScheme("file"), true);
      assert.strictEqual(boundary.BoundaryManager.checkScheme("untitled"), true);
      assert.strictEqual(boundary.BoundaryManager.checkScheme("output"), false);
    });
  });

  describe("add", function () {
    it("test", async function () {
      //scheme = "output"
      ({ bm, channel, config, document, editor } = await prepare2("boundary01.txt"));
      assert.strictEqual(bm.documentBoundaries.length, 0);
      bm.add(document);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY01);

      bm.add(document);
      assert.strictEqual(bm.documentBoundaries.length, 1);
    });
  });

  describe("delete", function () {
    it("test", async function () {
      //scheme = "output"
      ({ bm, channel, config, document, editor } = await prepare2("boundary01.txt"));
      bm.add(document);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY01);

      bm.delete(document);
      assert.strictEqual(bm.documentBoundaries.length, 0);
    });
  });

  describe("modify", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("boundary01.txt"));
      bm.add(document);
    });
    it("no Change", function () {
      bm.modify(0, 0, 0);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY01);
    });

    it("delete", function () {
      bm.modify(-1, 0, 0);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      const expected = Array.from(BOUNDARY01);
      expected.splice(0, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, expected);
    });

    it("add", function () {
      bm.modify(1, 0, 0);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      const expected = Array.from(BOUNDARY01);
      expected.unshift(undefined);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, expected);
    });
  });

  describe("change", function () {
    let dispose = null;
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("moveTest.txt"));
      bm.add(document);
      dispose = vscode.workspace.onDidChangeTextDocument((event) => {
        bm.change(event);
      });
    });
    afterEach(async function () {
      await vscode.commands.executeCommand("undo");
      dispose.dispose();
    });

    it("deleteLine", async function () {
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      await vscodeUtil.vsDeleteLine(document, 0);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      const expected = Array.from(BOUNDARY_MOVETEST);
      expected.splice(0, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, expected);
    });
    it("insertLine", async function () {
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      await vscodeUtil.vsInsertLine(document, 0, "123cat");
      const expected = Array.from(BOUNDARY_MOVETEST);
      expected.splice(0, 0, [b("Nd", 0, 3), b("Ll", 3, 3), b("EOL", 6, 0)]);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, expected);
    });
    it("replaceLine", async function () {
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      await vscodeUtil.vsReplaceLine(document, 0, "456dog");
      const expected = Array.from(BOUNDARY_MOVETEST);
      expected[0] = [b("Nd", 0, 3), b("Ll", 3, 3), b("EOL", 6, 0)];
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, expected);
    });
  });

  describe("move", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("moveTest.txt"));
    });
    it("left add", function () {
      editor.selection = new vscode.Selection(1, 5, 1, 5);
      const expected = new vscode.Selection(1, 4, 1, 4);
      assert.strictEqual(bm.documentBoundaries.length, 0);
      bm.move(editor, true);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("left", function () {
      bm.add(document);
      editor.selection = new vscode.Selection(1, 8, 1, 8);
      const expected = new vscode.Selection(1, 6, 1, 6);
      bm.move(editor, true);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("right add", function () {
      editor.selection = new vscode.Selection(1, 5, 1, 5);
      const expected = new vscode.Selection(1, 6, 1, 6);
      assert.strictEqual(bm.documentBoundaries.length, 0);
      bm.move(editor, false);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("right", function () {
      bm.add(document);
      editor.selection = new vscode.Selection(1, 8, 1, 8);
      const expected = new vscode.Selection(1, 10, 1, 10);
      bm.move(editor, false);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
  });

  describe("select", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("moveTest.txt"));
    });
    it("left add", function () {
      editor.selection = new vscode.Selection(1, 5, 1, 5);
      const expected = new vscode.Selection(1, 5, 1, 4);
      assert.strictEqual(bm.documentBoundaries.length, 0);
      bm.select(editor, true);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("left", function () {
      bm.add(document);
      editor.selection = new vscode.Selection(1, 8, 1, 8);
      const expected = new vscode.Selection(1, 8, 1, 6);
      bm.select(editor, true);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("right add", function () {
      editor.selection = new vscode.Selection(1, 5, 1, 5);
      const expected = new vscode.Selection(1, 5, 1, 6);
      assert.strictEqual(bm.documentBoundaries.length, 0);
      bm.select(editor, false);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
    it("right", function () {
      bm.add(document);
      editor.selection = new vscode.Selection(1, 8, 1, 8);
      const expected = new vscode.Selection(1, 8, 1, 10);
      bm.select(editor, false);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
  });

  describe("jump", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("moveTest.txt"));
      bm.add(document);
    });
    it("test", async function () {
      editor.selection = new vscode.Selection(1, 0, 1, 0);
      let expected = new vscode.Selection(2, 2, 2, 2);
      bm.jump(editor, 0, 2, 1);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(bm.documentBoundaries[0].lineBoundaries, BOUNDARY_MOVETEST);
      assert.deepStrictEqual(editor.selection, expected);
    });
  });

  describe("getLineCount", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("moveTest.txt"));
    });
    it("add", async function () {
      assert.strictEqual(bm.documentBoundaries.length, 0);
      const result = bm.getLineCount(editor);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(result, { documentIndex: 0, lineCount: editor.document.lineCount });
    });
    it("not add", async function () {
      bm.add(document);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      const result = bm.getLineCount(editor);
      assert.strictEqual(bm.documentBoundaries.length, 1);
      assert.deepStrictEqual(result, { documentIndex: 0, lineCount: editor.document.lineCount });
    });
  });

  describe("getVisibleRange", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("defaultOpen.txt"));
    });

    it("test", async function () {
      await vscode.commands.executeCommand("revealLine", { lineNumber: 0, at: "top" });
      const result = bm.getVisibleRange(editor);
      assert.deepStrictEqual(result, {
        documentIndex: 0,
        start: editor.visibleRanges[0].start.line,
        end: editor.visibleRanges[0].end.line,
      });
    });
  });

  describe("getLineDecorationRanges", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("decorationRange.txt"));
      bm.add(document);
    });

    it("test", async function () {
      const result = bm.getLineDecorationRanges(0, 0, vscodeUtil.convertToString(0));
      assert.deepStrictEqual(result, LINE_DECORATION_RANGES);
    });
  });

  describe("getDecorationRanges", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("decorationRange.txt"));
      bm.add(document);
    });

    it("test", async function () {
      const result = bm.getDecorationRanges(0, 0, 1);
      assert.deepStrictEqual(result, DECORATION_RANGES);
    });
  });

  describe("compareEq", function () {
    it("test", function () {
      const x = 0;
      const y = 1;
      const z = 2;
      let [left, right] = [0, 10];
      let result = boundary.BoundaryManager.compareEq(x, y, 5, left, right);
      assert.deepStrictEqual(result, [6, 10]);

      result = boundary.BoundaryManager.compareEq(y, y, 5, left, right);
      assert.deepStrictEqual(result, [5]);

      result = boundary.BoundaryManager.compareEq(z, y, 5, left, right);
      assert.deepStrictEqual(result, [0, 4]);
    });
  });

  describe("compare", function () {
    it("test", function () {
      const x = { textContent: vscodeUtil.convertToString(0) };
      const y = { textContent: vscodeUtil.convertToString(1) };
      const z = { textContent: vscodeUtil.convertToString(2) };
      let [left, right] = [0, 10];
      //const target = vscodeUtil.convertToString(1);
      const target = 1;
      let result = boundary.BoundaryManager.compare(x, target, 5, left, right);
      assert.deepStrictEqual(result, [6, 10]);

      result = boundary.BoundaryManager.compare(y, target, 5, left, right);
      assert.deepStrictEqual(result, [5]);

      result = boundary.BoundaryManager.compare(z, target, 5, left, right);
      assert.deepStrictEqual(result, [0, 4]);
    });
  });

  describe("search", function () {
    beforeEach(async function () {
      ({ bm, channel, config, document, editor } = await prepare2("decorationRange.txt"));
      bm.add(document);
    });

    it("test", async function () {
      const result = bm.search(DECORATION_RANGES, "bb");
      assert.deepStrictEqual(result, { lineIndex: 1, count: 2 });
    });
  });

  describe("info", function () {
    it.skip("pendding.現状 OutputChannelを見るAPIがない", function () {
      //skip
    });
  });
});