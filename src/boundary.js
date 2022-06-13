const vscode = require("vscode");
const vscodeUtil = require("./vscodeUtil.js");

class DocumentBoundary {
  /**
   * @param {vscode.TextDocument} document
   * @param {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean, AlwaysCenter: boolean, JumpToCenter: boolean }} config
   */
  constructor(document, config) {
    this.uri = document.uri;
    this.setConfig(config);
    this.lineBoundaries = this.scanAll(document);
  }

  /**
   * @param {string} shortValue
   * @param {number} start
   * @param {number} length
   * @returns {{ shortValue: string, start: number, length: number }}
   */
  static getBoundary(shortValue, start, length) {
    return {
      shortValue: shortValue,
      //string: string,
      start: start,
      length: length,
    };
  }

  /**
   * @param {string} string
   * @returns {string}
   */
  static escape(string) {
    const re = /(\^|\[|\]|-|\\)/gu;
    return string.replace(re, "\\$1");
  }

  /**
   * @param {string} specialCharacters
   * @returns {{ shortValue: string, longValue: string, regex: RegExp; }}
   */
  static compile(specialCharacters) {
    if (specialCharacters === "") {
      return null;
    }

    return {
      shortValue: "SPC",
      longValue: "SpecialCharacters",
      regex: new RegExp(`[${DocumentBoundary.escape(specialCharacters)}]`, "gu"),
    };
  }

  /**
   * @param {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean, AlwaysCenter: boolean, JumpToCenter: boolean }} config
   */
  setConfig(config) {
    this.SpecialRegex = DocumentBoundary.compile(config.SpecialCharacters);
    this.CapitalLetter = config.CapitalLetter;
    this.Japanese = config.Japanese;
    this.AlwaysCenter = config.AlwaysCenter;
    this.JumpToCenter = config.JumpToCenter;
  }

  /**
   * @param {{shortValue:string, start:number, length:number}} a
   * @param {{shortValue:string, start:number, length:number}} b
   * @returns {number}
   */
  static sorter(a, b) {
    return a.start - b.start;
  }

  /**
   * @param {string} string
   * @param {{ shortValue: string, longValue: string, regex: RegExp }[]} regexes
   * @param {number} start
   * @returns {{ shortValue: string, start: number, length: number }[]}
   */
  static scan(string, regexes, start = 0, japanese = false) {
    const result = [];
    let match = null;
    for (let re of regexes) {
      re.regex.lastIndex = 0;
      match = re.regex.exec(string);
      while (match !== null) {
        if (japanese === true && re.shortValue == "Lo") {
          result.push(...DocumentBoundary.scan(match[0], DocumentBoundary.ScriptJapanese, match.index + start));
        } else {
          result.push(DocumentBoundary.getBoundary(re.shortValue, match.index + start, match[0].length));
        }
        match = re.regex.exec(string);
      }
    }
    return result;
  }

  /**
   * @param {string} line
   * @param {{shortValue: string, start: number, length: number}[]} boundaries
   * @param {number} initial
   * @returns {{ start: number, string: string }[]}
   */
  static getRestStrings(line, boundaries, initial = 0) {
    let stringInfos = [];
    let start = 0;
    let string = line.substring(0, boundaries[0].start - initial);
    if (string.length > 0) {
      stringInfos.push({ start, string });
    }
    for (let i = 0; i < boundaries.length; ++i) {
      start = boundaries[i].start - initial + boundaries[i].length;
      if (i !== boundaries.length - 1) {
        string = line.substring(start, boundaries[i + 1].start - initial);
      } else {
        string = line.substring(start);
      }
      if (string.length > 0) {
        stringInfos.push({ start, string });
      }
    }
    return stringInfos;
  }

  /**
   * @param {string} line
   * @param {{ shortValue: string, longValue: string, regex: RegExp }} SpecialRegex
   * @param {number} start
   * @returns {{boundaries: {shortValue: string, start: number, length: number}[],
   *    stringInfos:{ start: number, string: string }[]}}
   */
  static scanSpecialCharacter(line, SpecialRegex, start = 0) {
    const ret = { boundaries: [], stringInfos: [{ start: 0, string: line }] };
    if (SpecialRegex === null) {
      return ret;
    }
    const boundaries = DocumentBoundary.scan(line, [SpecialRegex], start);
    if (boundaries.length === 0) {
      return ret;
    }
    return { boundaries, stringInfos: DocumentBoundary.getRestStrings(line, boundaries, start) };
  }

  /**
   * @param {{shortValue:string, start:number, length:number}[]} boundaries
   * @returns {{shortValue:string, start:number, length:number}[]}
   */
  static capitalLetter(boundaries) {
    for (let i = 0, len = boundaries.length - 1; i < len; ++i) {
      if (boundaries[i].shortValue === "Lu" && boundaries[i].length === 1 && boundaries[i + 1].shortValue === "Ll") {
        boundaries[i] = DocumentBoundary.getBoundary(
          "CCL",
          boundaries[i].start,
          boundaries[i].length + boundaries[i + 1].length
        );
        boundaries.splice(i + 1, 1);
        len -= 1;
      }
    }
    return boundaries;
  }

  /**
   * @param {string} line
   * @param {number} start
   * @returns {{shortValue:string, start:number, length:number}[]}
   */
  scanLine(line, start = 0, eol = true) {
    let { boundaries, stringInfos } = DocumentBoundary.scanSpecialCharacter(line, this.SpecialRegex, start);
    for (const stringInfo of stringInfos) {
      boundaries.push(
        ...DocumentBoundary.scan(
          stringInfo.string,
          DocumentBoundary.GeneralCategory,
          start + stringInfo.start,
          this.Japanese
        )
      );
    }
    boundaries.sort(DocumentBoundary.sorter);
    if (eol) {
      boundaries.push(DocumentBoundary.getBoundary("EOL", start + line.length, 1));
    }
    if (this.CapitalLetter === true) {
      boundaries = DocumentBoundary.capitalLetter(boundaries);
    }
    return boundaries;
  }

  /**
   * @param {vscode.TextDocument} document
   * @returns {{shortValue:string, start:number, length:number}[][]}
   */
  scanAll(document) {
    let result = [];
    for (let i = 0; i < document.lineCount; ++i) {
      result.push(this.scanLine(document.lineAt(i).text));
    }
    return result;
  }

  /**
   * @param {vscode.TextEditor} editor
   * @returns {{line: number, character: number}[]}
   */
  getPositionsLeft(editor, anchor = false) {
    let pos = null;
    let index = -1;
    const positions = [];
    for (let i = 0; i < editor.selections.length; ++i) {
      if (anchor === true) {
        pos = editor.selections[i].anchor;
      } else {
        pos = editor.selections[i].active;
      }
      index = DocumentBoundary.search(this.lineBoundaries[pos.line], pos.character, "lt");
      if (index !== -1) {
        positions.push({ line: pos.line, character: this.lineBoundaries[pos.line][index].start });
      } else {
        if (pos.line === 0) {
          positions.push({ line: 0, character: 0 });
        } else {
          positions.push({
            line: pos.line - 1,
            character: this.lineBoundaries[pos.line - 1][this.lineBoundaries[pos.line - 1].length - 1].start,
          });
        }
      }
    }
    return positions;
  }

  /**
   * @param {vscode.TextEditor} editor
   * @returns {{line: number, character: number}[]}
   */
  getPositionsRight(editor, anchor = false) {
    let pos = null;
    let index = -1;
    const positions = [];
    for (let i = 0; i < editor.selections.length; ++i) {
      if (anchor === true) {
        pos = editor.selections[i].anchor;
      } else {
        pos = editor.selections[i].active;
      }
      index = DocumentBoundary.search(this.lineBoundaries[pos.line], pos.character, "gt");
      if (index !== -1) {
        positions.push({ line: pos.line, character: this.lineBoundaries[pos.line][index].start });
      } else {
        if (pos.line === editor.document.lineCount - 1) {
          positions.push({
            line: pos.line,
            character: this.lineBoundaries[pos.line][this.lineBoundaries[pos.line].length - 1].start,
          });
        } else {
          positions.push({
            line: pos.line + 1,
            character: this.lineBoundaries[pos.line + 1][0].start,
          });
        }
      }
    }
    return positions;
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  async moveLeft(editor) {
    await vscodeUtil.moveCursors(editor, this.getPositionsLeft(editor));
    if (this.AlwaysCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  async moveRight(editor) {
    await vscodeUtil.moveCursors(editor, this.getPositionsRight(editor));
    if (this.AlwaysCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  async selectLeft(editor) {
    await vscodeUtil.moveSelections(editor, this.getPositionsLeft(editor));
    if (this.AlwaysCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  async selectRight(editor) {
    await vscodeUtil.moveSelections(editor, this.getPositionsRight(editor));
    if (this.AlwaysCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   * @param {number} lineIndex
   * @param {number} count
   */
  async jump(editor, lineIndex, count) {
    const boundary = this.lineBoundaries[lineIndex][count];
    const positions = [{ line: lineIndex, character: boundary.start }];
    await vscodeUtil.moveCursors(editor, positions);
    if (this.JumpToCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   * @param {number} lineIndex
   * @param {number} count
   */
  async selectJump(editor, lineIndex, count) {
    const boundary = this.lineBoundaries[lineIndex][count];
    const positions = [{ line: lineIndex, character: boundary.start }];
    await vscodeUtil.moveSelections(editor, positions);
    if (this.JumpToCenter === true) {
      await vscodeUtil.cursorToCenter(editor);
    }
  }

  /**
   * @param {number} v
   * @param {number} t
   * @param {number} i
   * @param {number} left
   * @param {number} right
   * @returns {number[]}
   */
  static compareGt(v, t, i, left, right) {
    if (v > t && right - left > 1) {
      return [left, i];
    } else if (v <= t) {
      return [i + 1, right];
    }
    return [];
  }

  /**
   * @param {number} v
   * @param {number} t
   * @param {number} i
   * @param {number} left
   * @param {number} right
   * @returns {number[]}
   */
  static compareLt(v, t, i, left, right) {
    if (v < t && right - left > 1) {
      return [i, right];
    } else if (v >= t) {
      return [left, i - 1];
    }
    return [];
  }

  /**
   * @param {number} v
   * @param {number} t
   * @param {number} i
   * @param {number} left
   * @param {number} right
   * @returns {number[]}
   */
  static compareEq(v, t, i, left, right) {
    if (v === t) {
      return [i];
    } else if (v < t) {
      return [i + 1, right];
    } else if (v > t) {
      return [left, i - 1];
    }
  }

  /**
   * @param {object} obj
   * @param {*} target
   * @param {number} index
   * @param {number} left
   * @param {number} right
   * @param {string} type
   * @returns {number[]}
   */
  static compare(obj, target, index, left, right, type = "eq") {
    const value = obj.start;
    if (type === "gt") {
      return DocumentBoundary.compareGt(value, target, index, left, right);
    } else if (type === "lt") {
      return DocumentBoundary.compareLt(value, target, index, left, right);
    }
    return DocumentBoundary.compareEq(value, target, index, left, right);
  }

  /**
   * @param {number} left
   * @param {number} right
   * @param {string} type
   * @returns {number}
   */
  static getMiddle(left, right, type = "eq") {
    if (type === "lt") {
      return Math.ceil(left + (right - left) / 2);
    } else {
      return Math.floor(left + (right - left) / 2);
    }
  }

  /**
   * @callback searchCompare
   * @param {object} obj
   * @param {number} target
   * @param {number} index
   * @param {number} left
   * @param {number} right
   * @param {string} type
   * @returns {number[]}
   */
  /**
   * @param {object[]} array
   * @param {number} target
   * @param {string} type
   * @param {searchCompare} compare
   * @returns {number}
   */
  static search(array, target, type = "eq", compare = DocumentBoundary.compare) {
    let [left, right] = [0, array.length - 1];
    let result = [];
    let index = 0;
    while (left <= right) {
      index = DocumentBoundary.getMiddle(left, right, type);
      result = compare(array[index], target, index, left, right, type);
      if (result.length === 0) {
        // if (type !== "eq") {
          return index;
        // }
        // return -1;
      } else if (type === "eq" && result.length === 1) {
        return result[0]; //index
      }
      [left, right] = result;
    }
    return -1;
  }

  /**
   * @param {string} line
   * @param {number} lineIndex
   */
  getLineInfo(line, lineIndex, sep = "‾") {
    const strings = [""];
    for (const cb of this.lineBoundaries[lineIndex]) {
      strings.push(line.substr(cb.start, cb.length));
    }
    let result = `${lineIndex}: ${strings.join(sep)}`; // ‾ ⁘ ⁛ ┊ █ 🁣 ⁞
    return result;
  }

  /**
   * @param {vscode.Uri} uri
   */
  isSameUri(uri) {
    return uri.path === this.uri.path ? true : false;
  }

  /**
   *
   * @param {number} lineIndex
   * @returns {number}
   */
  getLineLength(lineIndex) {
    const eolBoundary = this.lineBoundaries[lineIndex][this.lineBoundaries[lineIndex].length - 1];
    return eolBoundary.start + eolBoundary.length;
  }

  /**
   *
   * @param {number} lineIndex
   * @param {number} start 文字数
   * @param {number} end 文字数
   * @return {{shortValue:string, start:number, length:number}[]}
   */
  sliceLine(lineIndex, start, end) {
    const result = [];
    const boundary = this.lineBoundaries[lineIndex];
    for (let i = 0; i < boundary.length; ++i) {
      if (boundary[i].start + boundary[i].length <= start) {
        continue;
      }
      if (boundary[i].start >= end) {
        break;
      }

      const work = Object.assign({}, boundary[i]);
      if (work.start < start) {
        work.length -= start - work.start;
        work.start = start;
      }
      if (work.start + work.length > end) {
        work.length = end - work.start;
      }
      if (work.shortValue === "CCL") {
        if (work.start === boundary[i].start && work.length === 1) {
          work.shortValue = "Lu";
        } else if (work.start > boundary[i].start) {
          work.shortValue = "Ll";
        }
      } else if (
        this.CapitalLetter === true &&
        work.shortValue === "Lu" &&
        work.length === 1 &&
        work.start === boundary[i].start + boundary[i].length - 1 &&
        boundary[i + 1].shortValue === "Ll"
      ) {
        work.shortValue = "CCL";
        work.length += boundary[i + 1].length;
        i++;
      }
      result.push(work);
    }
    return result;
  }

  /**
   *
   * @param {number} startRow
   * @param {number} startColumn 文字数
   * @param {number} endRow
   * @param {number} endColumn 文字数
   * @return {{shortValue:string, start:number, length:number}[][]}
   */
  slice(startRow, startColumn, endRow = null, endColumn = null) {
    if (endRow === null || endRow >= this.lineBoundaries.length) {
      endRow = this.lineBoundaries.length - 1;
    }

    const result = this.lineBoundaries.slice(startRow, endRow + 1);
    if (result.length === 0) {
      return result;
    }
    let end = 0;
    let len = this.getLineLength(startRow);
    if (startRow === endRow) {
      end = endColumn !== null && endColumn < len ? endColumn : len;
      if (startColumn === end) {
        result.splice(0, 1);
      } else {
        result[0] = this.sliceLine(startRow, startColumn, end);
      }
      return result;
    } else {
      end = len;
      if (startColumn === end) {
        result.splice(0, 1);
      } else {
        result[0] = this.sliceLine(startRow, startColumn, end);
      }
    }
    len = this.getLineLength(endRow);
    end = endColumn !== null && endColumn < len ? endColumn : len;
    if (end === 0) {
      result.splice(result.length - 1, 1);
    } else {
      result[result.length - 1] = this.sliceLine(endRow, 0, end);
    }
    return result;
  }

  /**
   *
   * @param {{shortValue:string, start:number, length:number}[]} lineBoundaries "EOL" は無いものとする
   * @param {{shortValue:string, start:number, length:number}[]} data
   * @param {boolean} capitalLetter
   * in-place
   */
  static concatLine(lineBoundaries, data, capitalLetter) {
    if (data.length === 0) {
      return;
    }

    let tail = null;
    if (lineBoundaries.length !== 0) {
      tail = lineBoundaries[lineBoundaries.length - 1];
      if (
        (tail.shortValue === data[0].shortValue && tail.shortValue !== "SPC" && tail.shortValue !== "CCL") ||
        (tail.shortValue === "CCL" && data[0].shortValue === "Ll")
      ) {
        tail.length += data[0].length;
        data.shift();
      } else if (capitalLetter === true && tail.shortValue === "Lu" && data[0].shortValue === "Ll") {
        tail.shortValue = "CCL";
        tail.length += data[0].length;
        data.shift();
      } else if (tail.shortValue === "Lu" && data[0].shortValue === "CCL") {
        tail.length += 1;
        data[0] = DocumentBoundary.getBoundary("Ll", data[0].start + 1, data[0].length - 1);
      }
    }

    for (const boundary of data) {
      tail = lineBoundaries.length !== 0 ? lineBoundaries[lineBoundaries.length - 1] : { start: 0, length: 0 };
      boundary.start = tail.start + tail.length;
      lineBoundaries.push(boundary);
    }
  }

  /**
   * @param {{shortValue:string, start:number, length:number}[]} lineBoundaries
   * in-place
   */
  static check(lineBoundaries) {
    for (let i = 0; i < lineBoundaries.length; ++i) {
      if (i !== 0) {
        lineBoundaries[i].start = lineBoundaries[i - 1].start + lineBoundaries[i - 1].length;
      } else {
        lineBoundaries[i].start = 0;
      }
    }
  }

  /**
   * @param {{shortValue:string, start:number, length:number}[][]} boundaries1
   * @param {{shortValue:string, start:number, length:number}[][]} boundaries2
   * @param {boolean} capitalLetter
   * in-place
   */
  static concat(boundaries1, boundaries2, capitalLetter) {
    if (boundaries1.length !== 0) {
      const tail = boundaries1[boundaries1.length - 1][boundaries1[boundaries1.length - 1].length - 1];
      if (tail.shortValue !== "EOL") {
        DocumentBoundary.concatLine(
          boundaries1[boundaries1.length - 1],
          vscodeUtil.limitShift(boundaries2),
          capitalLetter
        );
      }
    }
    if (boundaries2.length === 0) {
      return boundaries1;
    }
    DocumentBoundary.check(boundaries2[0]);
    // boundaries1 = boundaries1.concat(boundaries2);
    Array.prototype.push.apply(boundaries1, boundaries2); // test どちらが速いか?
  }
}

// GeneralCategoryのどれにも当てはまらないものは存在するのか?
// 排他的
DocumentBoundary.GeneralCategory = [
  { shortValue: "Cc", longValue: "Control", regex: /\p{Cc}+/gu }, // tab
  { shortValue: "Cf", longValue: "Format", regex: /\p{Cf}+/gu },
  { shortValue: "Cn", longValue: "Unassigned", regex: /\p{Cn}+/gu },
  { shortValue: "Co", longValue: "Private_Use", regex: /\p{Co}+/gu },
  { shortValue: "Cs", longValue: "Surrogate", regex: /\p{Cs}+/gu },
  // { shortValue: "C", longValue: "Other" , regex: /\p{C}+/ug},
  // { shortValue: "LC", longValue: "Cased_Letter" , regex: /\p{LC}+/ug},
  { shortValue: "Ll", longValue: "Lowercase_Letter", regex: /\p{Ll}+/gu },
  { shortValue: "Lm", longValue: "Modifier_Letter", regex: /\p{Lm}+/gu },
  { shortValue: "Lo", longValue: "Other_Letter", regex: /\p{Lo}+/gu }, //漢字片仮名平仮名は全てLo
  { shortValue: "Lt", longValue: "Titlecase_Letter", regex: /\p{Lt}+/gu },
  { shortValue: "Lu", longValue: "Uppercase_Letter", regex: /\p{Lu}+/gu },
  //{ shortValue: "L", longValue: "Letter" , regex: /\p{L}+/ug},
  { shortValue: "Mc", longValue: "Spacing_Mark", regex: /\p{Mc}+/gu },
  { shortValue: "Me", longValue: "Enclosing_Mark", regex: /\p{Me}+/gu },
  { shortValue: "Mn", longValue: "Nonspacing_Mark", regex: /\p{Mn}+/gu },
  // { shortValue: "M", longValue: "Mark" , regex: /\p{M}+/ug},
  { shortValue: "Nd", longValue: "Decimal_Number", regex: /\p{Nd}+/gu },
  { shortValue: "Nl", longValue: "Letter_Number", regex: /\p{Nl}+/gu },
  { shortValue: "No", longValue: "Other_Number", regex: /\p{No}+/gu },
  // { shortValue: "N", longValue: "Number" , regex: /\p{N}+/ug},
  { shortValue: "Pc", longValue: "Connector_Punctuation", regex: /\p{Pc}+/gu },
  { shortValue: "Pd", longValue: "Dash_Punctuation", regex: /\p{Pd}+/gu }, // -
  { shortValue: "Pe", longValue: "Close_Punctuation", regex: /\p{Pe}+/gu },
  { shortValue: "Pf", longValue: "Final_Punctuation", regex: /\p{Pf}+/gu },
  { shortValue: "Pi", longValue: "Initial_Punctuation", regex: /\p{Pi}+/gu },
  { shortValue: "Po", longValue: "Other_Punctuation", regex: /\p{Po}+/gu }, // :"'、。も同じ
  { shortValue: "Ps", longValue: "Open_Punctuation", regex: /\p{Ps}+/gu },
  //{ shortValue: "P", longValue: "Punctuation" , regex: /\p{P}+/ug},
  { shortValue: "Sc", longValue: "Currency_Symbol", regex: /\p{Sc}+/gu },
  { shortValue: "Sk", longValue: "Modifier_Symbol", regex: /\p{Sk}+/gu },
  { shortValue: "Sm", longValue: "Math_Symbol", regex: /\p{Sm}+/gu },
  { shortValue: "So", longValue: "Other_Symbol", regex: /\p{So}+/gu },
  // { shortValue: "S", longValue: "Symbol" , regex: /\p{S}+/ug},
  { shortValue: "Zl", longValue: "Line_Separator", regex: /\p{Zl}+/gu },
  { shortValue: "Zp", longValue: "Paragraph_Separator", regex: /\p{Zp}+/gu },
  { shortValue: "Zs", longValue: "Space_Separator", regex: /\p{Zs}+/gu },
  // { shortValue: "Z", longValue: "Separator" , regex: /\p{Z}+/ug},
];
// 排他的
DocumentBoundary.ScriptJapanese = [
  { shortValue: "Kana", longValue: "Katakana", regex: /\p{sc=Kana}+/gu },
  { shortValue: "Hira", longValue: "Hiragana", regex: /\p{sc=Hira}+/gu },
  { shortValue: "Hani", longValue: "Han", regex: /\p{sc=Hani}+/gu },
  { shortValue: "Lo", longValue: "Other_Letter", regex: /[^\p{sc=Kana}\p{sc=Hira}\p{sc=Hani}]+/gu },
];

class BoundaryManager {
  /**
   * @param {vscode.OutputChannel} channel
   * @param {vscode.WorkspaceConfiguration} config
   */
  constructor(channel, config) {
    /** @type {DocumentBoundary[]} */
    this.documentBoundaries = [];
    this.channel = channel;
    this.setConfig(config);
    this.converter = new vscodeUtil.RadixConverter();
    this.compare = this._compare.bind(this);
  }

  /**
   * @param {vscode.WorkspaceConfiguration} config
   */
  setConfig(config) {
    this.SpecialCharacters = config.get("specialCharacters", BoundaryManager.DefaultSpecialCharacters);
    this.CapitalLetter = config.get("capitalLetter", BoundaryManager.DefaultCapitalLetter);
    this.Japanese = config.get("japanese", BoundaryManager.DefaultJapanese);
    this.JumpZoomOutLevel = config.get("jumpZoomOutLevel", BoundaryManager.DefaultJumpZoomOutLevel);
    this.AlwaysCenter = config.get("alwaysCenter", BoundaryManager.DefaultAlwaysCenter);
    this.JumpToCenter = config.get("jumpToCenter", BoundaryManager.DefaultJumpToCenter);
    const margin = config.get("markerMargin", BoundaryManager.DefaultMargin);
    if (vscodeUtil.isValidMargin(margin) === false) {
      this.MarkerMargin = BoundaryManager.DefaultMargin;
    } else {
      this.MarkerMargin = margin;
    }
  }

  /**
   * @return {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean, JumpZoomOutLevel: number, MarkerMargin: string, AlwaysCenter: boolean, JumpToCenter: boolean }}
   */
  getConfig() {
    return {
      SpecialCharacters: this.SpecialCharacters,
      CapitalLetter: this.CapitalLetter,
      Japanese: this.Japanese,
      JumpZoomOutLevel: this.JumpZoomOutLevel,
      MarkerMargin: this.MarkerMargin,
      AlwaysCenter: this.AlwaysCenter,
      JumpToCenter: this.JumpToCenter,
    };
  }

  /**
   * @param {vscode.WorkspaceConfiguration} config
   */
  config(config) {
    this.setConfig(config);
    this.documentBoundaries = [];
  }

  /**
   * @param {vscode.Uri} uri
   * @returns {number}
   */
  find(uri) {
    for (let i = 0; i < this.documentBoundaries.length; ++i) {
      if (uri.path === this.documentBoundaries[i].uri.path) {
        return i;
      }
    }
    return -1;
  }

  /**
   * @param {string} scheme
   * @returns {boolean}
   */
  static checkScheme(scheme) {
    for (const allow of BoundaryManager.Schemes) {
      if (scheme === allow) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {vscode.TextDocument} document
   */
  add(document) {
    if (BoundaryManager.checkScheme(document.uri.scheme) === false || this.find(document.uri) !== -1) {
      return;
    }
    let statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanMessage);
    this.documentBoundaries.push(new DocumentBoundary(document, this.getConfig()));
    statusBar.dispose();
    statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanEndMessage, BoundaryManager.MessageTimeout);
  }

  /**
   * @param {vscode.TextDocument} document
   */
  delete(document) {
    const index = this.find(document.uri);
    if (BoundaryManager.checkScheme(document.uri.scheme) === false || index === -1) {
      return;
    }
    this.documentBoundaries.splice(index, 1);
  }

  /**
   *
   * @param {string} text
   * @param {string} eol
   * @returns {{ shortValue: string, start: number, length: number }[][]}
   */
  getChange(documentIndex, text, eol, start) {
    const lines = text.split(eol);
    const result = [];
    let eolFlag = false;
    let s = start;
    for (let i = 0; i < lines.length; ++i) {
      eolFlag = i !== lines.length - 1 ? true : false;
      vscodeUtil.pushNoEmpty(result, this.documentBoundaries[documentIndex].scanLine(lines[i], s, eolFlag)); // 空配列の扱い
      s = 0;
    }
    return result;
  }

  /**
   *
   * @param {DocumentBoundary} documentBoundaries
   * @param {number} startRow
   * @param {number} startColumn
   * @param {number} endRow
   * @param {number} endColumn
   * @param {{ shortValue: string, start: number, length: number }[][]} data
   * @returns {{ shortValue: string, start: number, length: number }[][]}
   */
  replace(documentBoundaries, startRow, startColumn, endRow, endColumn, data) {
    const result = documentBoundaries.slice(0, 0, startRow, startColumn);
    DocumentBoundary.concat(result, data, this.CapitalLetter);
    DocumentBoundary.concat(result, documentBoundaries.slice(endRow, endColumn), this.CapitalLetter);
    return result;
  }

  /**
   * もう少し効率よくしたい。全探索したほうがましか?
   * @param {vscode.TextDocumentChangeEvent} event
   */
  async change(event) {
    if (BoundaryManager.checkScheme(event.document.uri.scheme) === false || event.contentChanges.length === 0) {
      return;
    }

    const documentIndex = this.find(event.document.uri);
    if (documentIndex === -1) {
      this.add(event.document);
      return;
    }

    // console.log(vscodeUtil.getTextDocumentChangeEventInfo(event));
    let statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanMessage);
    // this.documentBoundaries[documentIndex].lineBoundaries = this.documentBoundaries[documentIndex].scanAll(
    //   event.document
    // );
    const eol = vscodeUtil.getEol(event.document.eol);
    for (const change of event.contentChanges) {
      const data = this.getChange(documentIndex, change.text, eol, change.range.start.character);
      this.documentBoundaries[documentIndex].lineBoundaries = this.replace(
        this.documentBoundaries[documentIndex],
        change.range.start.line,
        change.range.start.character,
        change.range.end.line,
        change.range.end.character,
        data
      );
    }
    statusBar.dispose();
    statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanEndMessage, BoundaryManager.MessageTimeout);
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  move(editor, left = true) {
    if (BoundaryManager.checkScheme(editor.document.uri.scheme) === false) {
      if (left === true) {
        vscode.commands.executeCommand("cursorLeft");
      } else {
        vscode.commands.executeCommand("cursorRight");
      }
      return;
    }

    let index = this.find(editor.document.uri);
    if (index === -1) {
      this.add(editor.document);
      index = this.documentBoundaries.length - 1;
    }
    if (left === true) {
      this.documentBoundaries[index].moveLeft(editor);
    } else {
      this.documentBoundaries[index].moveRight(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  select(editor, left = true) {
    if (BoundaryManager.checkScheme(editor.document.uri.scheme) === false) {
      if (left === true) {
        vscode.commands.executeCommand("cursorLeftSelect");
      } else {
        vscode.commands.executeCommand("cursorRightSelect");
      }
      return;
    }

    let index = this.find(editor.document.uri);
    if (index === -1) {
      this.add(editor.document);
      index = this.documentBoundaries.length - 1;
    }
    if (left === true) {
      this.documentBoundaries[index].selectLeft(editor);
    } else {
      this.documentBoundaries[index].selectRight(editor);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  async jump(editor, selection = false) {
    if (this.JumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomOut(this.JumpZoomOutLevel);
    }
    const { documentIndex, start, end } = this.getVisibleRange(editor);
    if (documentIndex === -1 || end - start <= 0) {
      if (this.JumpZoomOutLevel > 0) {
        await vscodeUtil.fontZoomIn(this.JumpZoomOutLevel);
      }
      return;
    }
    const decorationRanges = this.getDecorationRanges(documentIndex, start, end);
    const decorationTypes = this.setDecorations(editor, decorationRanges);
    const result = await this.showBoundaryInputRange(decorationRanges);
    decorationTypes.dispose();
    if (this.JumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomIn(this.JumpZoomOutLevel);
    }
    if (result === null) {
      return;
    }

    if (selection === false) {
      await this.documentBoundaries[documentIndex].jump(editor, result.lineIndex, result.count);
    } else {
      await this.documentBoundaries[documentIndex].selectJump(editor, result.lineIndex, result.count);
    }
  }

  async jumpLine(editor, selection = false) {
    const { documentIndex, lineCount } = this.getLineCount(editor);
    if (documentIndex === -1 || lineCount <= 0) {
      return;
    }
    if (this.JumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomOut(this.JumpZoomOutLevel);
    }
    const lineIndex = await BoundaryManager.showLineInput(lineCount, editor.selection.active.line);
    if (lineIndex === -1) {
      if (this.JumpZoomOutLevel > 0) {
        await vscodeUtil.fontZoomIn(this.JumpZoomOutLevel);
      }
      return;
    }

    const lineDecorationRanges = this.getLineDecorationRanges(documentIndex, lineIndex);
    const decorationTypes = this.setDecorations(editor, [lineDecorationRanges]);
    const count = await this.showBoundaryInput(lineDecorationRanges);
    decorationTypes.dispose();
    if (this.JumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomIn(this.JumpZoomOutLevel);
    }
    if (count === -1) {
      return;
    }

    if (selection === false) {
      await this.documentBoundaries[documentIndex].jump(editor, lineIndex, count);
    } else {
      await this.documentBoundaries[documentIndex].selectJump(editor, lineIndex, count);
    }
  }

  /**
   * @param {vscode.TextEditor} editor
   * @returns {{ documentIndex: number, lineCount: number }}
   */
  getLineCount(editor) {
    if (BoundaryManager.checkScheme(editor.document.uri.scheme) === false) {
      return { documentIndex: -1, lineCount: 0 };
    }
    let index = this.find(editor.document.uri);
    if (index === -1) {
      this.add(editor.document);
      index = 0;
    }
    return { documentIndex: index, lineCount: editor.document.lineCount };
    //return { documentIndex: index, lineCount: this.documentBoundaries[index].lineBoundaries.length };
  }

  /**
   * @param {vscode.TextEditor} editor
   * @returns {{ documentIndex: number, start: number, end: number }}
   */
  getVisibleRange(editor) {
    if (BoundaryManager.checkScheme(editor.document.uri.scheme) === false) {
      return { documentIndex: -1, start: 0, end: 0 };
    }
    let index = this.find(editor.document.uri);
    if (index === -1) {
      this.add(editor.document);
      index = 0;
    }
    // need fix
    return { documentIndex: index, start: editor.visibleRanges[0].start.line, end: editor.visibleRanges[0].end.line };
  }

  /**
   * @param {number} documentIndex
   * @param {number} lineIndex
   * @param {string} lineString
   * @returns {{ range: vscode.Range, textContent: string, lineIndex: number, index: number }[]}
   */
  getLineDecorationRanges(documentIndex, lineIndex, lineString = "") {
    const lineDecorationRanges = [];
    let count = 0;
    const lineBoundaries = this.documentBoundaries[documentIndex].lineBoundaries[lineIndex];
    for (let i = 0, len = lineBoundaries.length; i < len; ++i) {
      if (lineBoundaries[i].shortValue === "Zs") {
        continue;
      } // 長さが1のものを候補から外すなど
      lineDecorationRanges.push({
        range: new vscode.Range(
          lineIndex,
          lineBoundaries[i].start,
          lineIndex,
          lineBoundaries[i].start + lineBoundaries[i].length
        ),
        textContent: lineString + this.converter.convertToString(count),
        lineIndex,
        index: i,
      });
      count++;
    }
    return lineDecorationRanges;
  }

  /**
   * @param {number} documentIndex
   * @param {number} start
   * @param {number} end
   * @returns {{ range: vscode.Range, textContent: string, lineIndex: number, index: number }[][]}
   */
  getDecorationRanges(documentIndex, start, end) {
    const decorationRanges = [];
    for (let i = 0; i <= end - start; ++i) {
      decorationRanges.push(this.getLineDecorationRanges(documentIndex, i + start, this.converter.convertToString(i)));
    }
    return decorationRanges;
  }

  /**
   * @param {number} v
   * @param {number} n
   * @param {number} i
   * @param {number} left
   * @param {number} right
   * @returns {number[]}
   */
  static compareEq(v, n, i, left, right) {
    if (v === n) {
      return [i];
    } else if (v < n) {
      return [i + 1, right];
    } else if (v > n) {
      return [left, i - 1];
    }
    return [];
  }

  /**
   * @param {object} obj
   * @param {number} target
   * @param {number} index
   * @param {number} left
   * @param {number} right
   * @param {string} _type
   * @returns {number[]}
   */
  _compare(obj, target, index, left, right, _type = "") {
    const v = this.converter.convertToNumber(obj.textContent);
    return BoundaryManager.compareEq(v, target, index, left, right);
  }

  /**
   * @param {{ range: vscode.Range, textContent: string, lineIndex: number, index: number }[][]} decorationRanges
   * @param {string} textContent
   * @return {{ lineIndex: number, count: number }}
   * 線形探索になってしまっている
   * need fix: "aaa"が来た場合、"a aa", "aa a"の2つが考えられる。現状2つを判定できない
   * 入力形式を変える "1aa", "27a". "a-aa", "aa-a". "Aa", "AAa".
   * 数値の割り振り方を変える
   */
  search(decorationRanges, textContent) {
    const target = this.converter.convertToNumber(textContent);
    let min = 0;
    let max = 0;
    let index = 0;
    for (const lineDecorationRanges of decorationRanges) {
      min = this.converter.convertToNumber(lineDecorationRanges[0].textContent);
      max = this.converter.convertToNumber(lineDecorationRanges[lineDecorationRanges.length - 1].textContent);
      if (target >= min && target <= max) {
        index = DocumentBoundary.search(lineDecorationRanges, target, "eq", this.compare);
        if (index !== -1) {
          return { lineIndex: lineDecorationRanges[index].lineIndex, count: lineDecorationRanges[index].index };
        }
      }
    }
    return null;
  }

  /**
   * @param {import("vscode").TextEditor} editor
   * @param {{range: import("vscode").Range, textContent: string, index: number}[][]} decorationRanges
   */
  setDecorations(editor, decorationRanges) {
    const decorationType = vscode.window.createTextEditorDecorationType({});
    const options = [];
    for (const lineDecorationRanges of decorationRanges) {
      for (const option of lineDecorationRanges) {
        options.push({
          range: option.range,
          renderOptions: {
            before: {
              contentText: option.textContent,
              margin: this.MarkerMargin,
              fontStyle: "normal",
              fontWeight: "normal",
              color: { id: "boundaryMove.markerColor" },
              backgroundColor: { id: "boundaryMove.markerBackgroundColor" },
            },
          },
        });
      }
    }
    editor.setDecorations(decorationType, options);
    return decorationType;
  }

  /**
   * @param {number} lineCount
   */
  static async showLineInput(lineCount, currentLine) {
    const rangeString = `range: 1 -- ${lineCount}`;
    const line = (currentLine + 1).toString(10);
    const result = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input line index for jump. ${rangeString}`,
      value: line,
      valueSelection: [0, line.length],
    });
    if (vscodeUtil.isEmpty(result) === true) {
      return -1;
    }
    let lineIndex = parseInt(result, 10) - 1;
    if (lineIndex < 0) {
      lineIndex = 0;
    } else if (lineIndex >= lineCount) {
      lineIndex = lineCount - 1;
    }
    return lineIndex;
  }

  /**
   * @param {{range: import("vscode").Range, textContent: string, index: number}[]} lineDecorationRanges
   */
  async showBoundaryInput(lineDecorationRanges) {
    const rangeString = `range: a -- ${this.converter.convertToString(lineDecorationRanges.length - 1)}`;
    const result = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input boundary index for jump. ${rangeString}`,
      value: "a",
    });
    if (vscodeUtil.isEmpty(result) === true) {
      return -1;
    }
    let i = this.converter.convertToNumber(result);
    let count = 0;
    if (i < 0) {
      count = lineDecorationRanges[0].index;
    } else if (i >= lineDecorationRanges.length) {
      count = lineDecorationRanges[lineDecorationRanges.length - 1].index;
    } else {
      count = lineDecorationRanges[i].index;
    }
    return count;
  }

  async showBoundaryInputRange(decorationRanges) {
    const rangeString = `range: aa -- ${
      decorationRanges[decorationRanges.length - 1][decorationRanges[decorationRanges.length - 1].length - 1]
        .textContent
    }`;
    const input = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input boundary index for jump. ${rangeString}`,
    });
    if (vscodeUtil.isEmpty(input) === true) {
      return null;
    }
    return this.search(decorationRanges, input);
  }

  info() {
    this.channel.appendLine(`Documents: ${this.documentBoundaries.length}`);
    let result = "";
    let document = null;
    for (const cb of this.documentBoundaries) {
      result = vscodeUtil.uriToString(cb.uri);
      this.channel.appendLine(`${result}`);

      result = vscodeUtil.objToString(this.getConfig());
      this.channel.appendLine(`${result}`);

      document = vscodeUtil.getTextDocument(cb.uri);
      if (document === null) {
        continue;
      }
      this.channel.appendLine(`lineCount: ${cb.lineBoundaries.length}`);

      for (let i = 0; i < cb.lineBoundaries.length; ++i) {
        this.channel.appendLine(`${cb.getLineInfo(document.lineAt(i).text, i)}`);
      }
    }
    this.channel.show();
  }
}
BoundaryManager.Schemes = ["file", "untitled", "vscode-userdata"]; // NG: output
BoundaryManager.ScanMessage = "Boundary Move Scanning...";
BoundaryManager.ScanEndMessage = "Boundary Move Scan End.";
BoundaryManager.MessageTimeout = 3000;
BoundaryManager.DefaultCapitalLetter = true;
BoundaryManager.DefaultJapanese = false;
BoundaryManager.DefaultJumpZoomOutLevel = 1;
BoundaryManager.DefaultAlwaysCenter = false;
BoundaryManager.DefaultJumpToCenter = false;
BoundaryManager.DefaultSpecialCharacters = "\"'`()[]{}";
BoundaryManager.DefaultMargin = "0ex 0.3ex 0ex 0.7ex";

exports.DocumentBoundary = DocumentBoundary;
exports.BoundaryManager = BoundaryManager;
