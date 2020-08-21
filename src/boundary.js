const vscode = require("vscode");
const vscodeUtil = require("./vscodeUtil.js");

class DocumentBoundary {
  /**
   * @param {vscode.TextDocument} document
   * @param {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean }} config
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
   * @returns {{ shortValue: string, start: number, length: number; }}
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
   * @param {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean }} config
   */
  setConfig(config) {
    this.SpecialRegex = DocumentBoundary.compile(config.SpecialCharacters);
    this.CapitalLetter = config.CapitalLetter;
    this.Japanese = config.Japanese;
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
   * @returns {{ start: number, string: string }[]}
   */
  static getRestStrings(line, boundaries) {
    let stringInfos = [];
    let start = 0;
    let string = line.substring(0, boundaries[0].start);
    if (string.length > 0) {
      stringInfos.push({ start, string });
    }
    for (let i = 0; i < boundaries.length; ++i) {
      start = boundaries[i].start + boundaries[i].length;
      if (i !== boundaries.length - 1) {
        string = line.substring(start, boundaries[i + 1].start);
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
    return { boundaries, stringInfos: DocumentBoundary.getRestStrings(line, boundaries) };
  }

  /**
   * @param {{shortValue:string, start:number, length:number}[]} boundaries
   * @returns {{shortValue:string, start:number, length:number}[]}
   */
  static capitalLetter(boundaries) {
    for (let i = 0, len = boundaries.length - 1; i < len; ++i) {
      if (boundaries[i].shortValue === "Lu" && boundaries[i].length === 1 && boundaries[i + 1].shortValue === "Ll") {
        //string: boundary[i].string + boundary[i + 1].string,
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
      console.log(`"${document.lineAt(i).text}"`);
      result.push(this.scanLine(document.lineAt(i).text));
    }
    return result;
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {{ start: number; end: number; }} lineIndex
   */
  changeLines(document, lineIndex) {
    for (let i = lineIndex.start; i < document.lineCount && i <= lineIndex.end; ++i) {
      this.lineBoundaries[i] = this.scanLine(document.lineAt(i).text);
    }
  }

  // /**
  //  * @param {number} diff
  //  * @param {number} lineIndex
  //  */
  // modify(diff, lineIndex) {
  //   if (diff > 0) {
  //     const insert = new Array(diff);
  //     insert.fill([]);
  //     this.lineBoundaries.splice(lineIndex, 0, ...insert);
  //   } else if (diff < 0) {
  //     this.lineBoundaries.splice(lineIndex, diff * -1);
  //   }
  // }

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
  moveLeft(editor) {
    vscodeUtil.moveCursors(editor, this.getPositionsLeft(editor));
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  moveRight(editor) {
    vscodeUtil.moveCursors(editor, this.getPositionsRight(editor));
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  selectLeft(editor) {
    vscodeUtil.moveSelections(editor, this.getPositionsLeft(editor));
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  selectRight(editor) {
    vscodeUtil.moveSelections(editor, this.getPositionsRight(editor));
  }

  /**
   * @param {vscode.TextEditor} editor
   * @param {number} lineIndex
   * @param {number} count
   */
  jump(editor, lineIndex, count) {
    // if (lineIndex >= this.lineBoundaries.length || count >= this.lineBoundaries[lineIndex].length) {
    //   return;
    // }
    const boundary = this.lineBoundaries[lineIndex][count];
    const positions = [{ line: lineIndex, character: boundary.start }];
    vscodeUtil.moveCursors(editor, positions);
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
        if (type !== "eq") {
          return index;
        }
        return -1;
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

  getLineLength(lineIndex) {
    const eolBoundary = this.lineBoundaries[lineIndex][this.lineBoundaries[lineIndex].length - 1];
    return eolBoundary.start + eolBoundary.length;
  }

  slice(startRow, startColumn, endRow = null, endColumn = null) {
    if (endRow === null || endRow >= this.lineBoundaries.length) {
      endRow = this.lineBoundaries.length - 1;
    }

    const result = [];
    let start = 0;
    let end = 0;

    for (let row = startRow; row <= endRow; ++row) {
      const len = this.getLineLength(row);
      if (row === startRow) {
        start = startColumn;
        end = len;
        if (startRow === endRow) {
          end = endColumn !== null ? endColumn : len;
        }
      } else if (row === endRow) {
        start = 0;
        end = endColumn !== null ? endColumn : len;
      } else {
        start = 0;
        end = len;
      }
      if (start !== end) {
        result.push(this.sliceLine(row, start, end));
      }
    }
    return result;
  }

  sliceLine(lineIndex, start, end = null) {
    const len = this.getLineLength(lineIndex);
    if (end === null || end > len) {
      end = len;
    }

    const result = [];
    for (const boundary of this.lineBoundaries[lineIndex]) {
      if (boundary.start + boundary.length <= start) {
        continue;
      }
      if (boundary.start >= end) {
        break;
      }

      const work = Object.assign({}, boundary);
      if (work.start < start) {
        work.length -= start - work.start;
        work.start = start;
      }
      if (work.start + work.length > end) {
        work.length = end - work.start;
      }
      if (work.shortValue === "CCL") {
        if (work.start === boundary.start && work.length === 1) {
          work.shortValue = "Lu";
        } else if (work.start > boundary.start) {
          work.shortValue = "Ll";
        }
      }
      result.push(work);
    }
    return result;
  }

  //"EOL" は無いものとする
  static concatLine(lineBoundaries, data, capitalLetter) {
    let result = Array.from(lineBoundaries);
    if (data.length === 0) {
      return result;
    }
    let tail = result[result.length - 1];
    if (tail.shortValue === data[0].shortValue || (tail.shortValue === "CCL" && data[0].shortValue === "Ll")) {
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

    for (const boundary of data) {
      tail = result[result.length - 1];
      boundary.start = tail.start + tail.length;
      result.push(boundary);
    }
    return result;
  }

  static check(lineBoundaries) {
    const result = [];
    for (let i = 0; i < lineBoundaries.length; ++i) {
      const work = Object.assign({}, lineBoundaries[i]);
      if (i !== 0) {
        work.start = lineBoundaries[i - 1].start + lineBoundaries[i - 1].length;
      } else {
        work.start = 0;
      }
      result.push(work);
    }
    return result;
  }

  static concat(boundaries1, boundaries2, capitalLetter) {
    let tail = [];
    let result = boundaries1;
    if (boundaries1.length !== 0) {
      tail = boundaries1[boundaries1.length - 1][boundaries1[boundaries1.length - 1].length - 1];
      if (tail.shortValue !== "EOL") {
        result[result.length - 1] = DocumentBoundary.concatLine(
          boundaries1[boundaries1.length - 1],
          vscodeUtil.limitShift(boundaries2),
          capitalLetter
        );
      }
    }
    if (boundaries2.length === 0) {
      return result;
    }
    boundaries2[0] = DocumentBoundary.check(boundaries2[0]);
    result = vscodeUtil.concat2d(result, boundaries2);
    return result;
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
    this.SpecialCharacters = config.get("specialCharacters", BoundaryManager.DefaultSpecialCharactors);
    this.CapitalLetter = config.get("capitalLetter", BoundaryManager.DefaultCapitalLetter);
    this.Japanese = config.get("japanese", BoundaryManager.DefaultJapanese);
    const margin = config.get("markerMargin", BoundaryManager.DefaultMargin);
    if (vscodeUtil.isValidMargin(margin) === false) {
      this.MarkerMargin = BoundaryManager.DefaultMargin;
    } else {
      this.MarkerMargin = margin;
    }
  }

  /**
   * @return {{ SpecialCharacters: string, CapitalLetter: boolean, Japanese: boolean, MarkerMargin: string }}
   */
  getConfig() {
    return {
      SpecialCharacters: this.SpecialCharacters,
      CapitalLetter: this.CapitalLetter,
      Japanese: this.Japanese,
      MarkerMargin: this.MarkerMargin,
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

  // /**
  //  * @param {number} documentIndex
  //  * @param {number} diff
  //  * @param {number} start
  //  */
  // modify(documentIndex, diff, start) {
  //   if (diff > 0) {
  //     this.documentBoundaries[documentIndex].modify(diff, start + diff);
  //   }
  //   if (diff < 0) {
  //     this.documentBoundaries[documentIndex].modify(diff, start);
  //   }
  // }

  ff(documentBoundaries, startRow, startColumn, endRow, endColumn, data) {
    let result = documentBoundaries.slice(0, 0, startRow, startColumn);
    let tail = documentBoundaries.slice(endRow, endColumn);
    result = DocumentBoundary.concat(result, data, this.CapitalLetter);
    result = DocumentBoundary.concat(result, tail, this.CapitalLetter);
    return result;
    // // let needCheck = [];
    // if (head.length !== 0) {
    //   if (head[head.length - 1][head[head.length - 1].length - 1].shortValue !== "EOL") {
    //     documentBoundaries.concatLine(head[head.length - 1], vscodeUtil.limitShift(data));
    //     //head[head.length - 1] = head[head.length - 1].concat(vscodeUtil.limitShift(data));
    //     // needCheck.push({ start: vscodeUtil.subLimit(head.length, 1), end: vscodeUtil.subLimit(head.length, 1) });
    //     // head = [vscodeUtil.arrayReplace(head, head.length - 1, head[head.length - 1].length - 1, data.shift(), true)];
    //   }
    //   work = vscodeUtil.concat2d(head, data); // 空配列の扱い
    //   // needCheck.push({
    //   //   start: vscodeUtil.subLimit(head.length, 1),
    //   //   end: vscodeUtil.subLimit(head.length, 1) + vscodeUtil.subLimit(data.length, 1),
    //   // });
    // } else {
    //   work = data;
    //   // needCheck.push({ start: 0, end: vscodeUtil.subLimit(data.length, 1) });
    // }
    // if (tail.length !== 0) {
    //   if (
    //     work.length !== 0 &&
    //     work[work.length - 1].length !== 0 &&
    //     work[work.length - 1][work[work.length - 1].length - 1].shortValue !== "EOL"
    //   ) {
    //     documentBoundaries.concatLine(work[work.length - 1], vscodeUtil.limitShift(tail));

    //     // work[work.length - 1] = work[work.length - 1].concat(vscodeUtil.limitShift(tail));
    //     // needCheck.push({ start: vscodeUtil.subLimit(work.length, 1), end: vscodeUtil.subLimit(work.length, 1) });
    //     // result = [
    //     //   vscodeUtil.arrayReplace(result, result.length - 1, result[result.length - 1].length - 1, tail.shift(), true),
    //     // ];
    //   }
    //   work = vscodeUtil.concat2d(work, tail); // 空配列の扱い
    //   // needCheck.push({ start: vscodeUtil.subLimit(work.length, 1), end: vscodeUtil.subLimit(work.length, 1) });
    // }
    // documentBoundaries.lineBoundaries = work;
    // // needCheck = needCheck.filter((e, i, a) => {
    // //   if (i !== a.length - 1 && a[i].start === a[i + 1].start && a[i].end === a[i + 1].end) {
    // //     return false;
    // //   }
    // //   return true;
    // // });
    // // return needCheck;
  }

  // getIndex(documentIndex, lineIndex, character) {
  //   const boundaries = this.documentBoundaries[documentIndex].lineBoundaries[lineIndex];
  //   for (let i = 0; i < boundaries.length; ++i) {
  //     if (
  //       character === boundaries[i].start ||
  //       (character > boundaries[i].start && character < boundaries[i].start + boundaries[i].length)
  //     ) {
  //       return i;
  //     }
  //   }
  //   return -1;
  // }

  /**
   *
   * @param {string} text
   * @param {string} eol
   */
  getChange(documentIndex, text, eol, start) {
    // const lines = vscodeUtil.splitIncludeSepatator(text, eol);
    const lines = text.split(eol);
    const result = [];
    let eolFlag = false;
    let s = start;
    for (let i = 0; i < lines.length; ++i) {
      if (i !== lines.length - 1) {
        eolFlag = true;
      } else {
        eolFlag = false;
      }
      // result.push(this.documentBoundaries[documentIndex].scanLine(lines[i], s, eolFlag));
      vscodeUtil.pushNoEmpty(result, this.documentBoundaries[documentIndex].scanLine(lines[i], s, eolFlag)); // 空配列の扱い
      s = 0;
      console.log(result[i]);
    }
    return result;
  }

  // check(document, documentBoundaries, needCheck) {
  //   for (const { start, end } of needCheck) {
  //     for (let i = start; i <= end; ++i) {
  //       documentBoundaries.lineBoundaries[i] = documentBoundaries.scanLine(document.lineAt(i).text);
  //     }
  //   }
  // }

  // check(documentIndex, startLine, endLine) {
  //   for (let i = startLine; i <= endLine; ++i) {
  //     let length = 0;
  //     const boundaries = this.documentBoundaries[documentIndex].lineBoundaries[i];
  //     if (boundaries.length === 0) {
  //       continue;
  //     }
  //     for (let j = 0; j < boundaries.length; ++j) {
  //       if (boundaries[j].shortValue === "EOL") {
  //         boundaries.splice(j, 1);
  //       } else if (j !== boundaries.length - 1 && boundaries[j].shortValue === boundaries[j + 1].shortValue) {
  //         boundaries[j].length = boundaries[j].length + boundaries[j + 1].length;
  //         boundaries.splice(j + 1, 1);
  //       }
  //       if (j < boundaries.length) {
  //         boundaries[j].start = length;
  //         length += boundaries[j].length;
  //       }
  //     }
  //     boundaries.push(DocumentBoundary.getBoundary("EOL", length, 1));
  //   }
  // }

  /**
   * もう少し効率よくしたい
   * @param {vscode.TextDocumentChangeEvent} event
   */
  change(event) {
    if (BoundaryManager.checkScheme(event.document.uri.scheme) === false || event.contentChanges.length === 0) {
      return;
    }

    const documentIndex = this.find(event.document.uri);
    if (documentIndex === -1) {
      this.add(event.document);
      return;
    }

    console.log(vscodeUtil.getTextDocumentChangeEventInfo(event));
    let statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanMessage);
    for (const change of event.contentChanges) {
      const eolCount = vscodeUtil.getEol(event.document.eol);
      const data = this.getChange(documentIndex, change.text, eolCount, change.range.start.character);

      // console.log(
      //   `${change.range.start.line},${this.getIndex(
      //     documentIndex,
      //     change.range.start.line,
      //     change.range.start.character
      //   )}`,
      //   `${change.range.end.line},${this.getIndex(documentIndex, change.range.end.line, change.range.end.character)}`
      // );
      // // this.documentBoundaries[documentIndex].modify(vscodeUtil.subLimit(data.length, 1), change.range.start.line);
      this.documentBoundaries[documentIndex].lineBoundaries = this.ff(
        this.documentBoundaries[documentIndex],
        change.range.start.line,
        change.range.start.character,
        change.range.end.line,
        change.range.end.character,
        data
      );
      // this.check(event.document, this.documentBoundaries[documentIndex], needCheck);
      // console.log(
      //   `${change.range.start.line}, ${change.range.start.character} -- ${change.range.end.line}, ${change.range.end.character}`
      // );
      for (const x of this.documentBoundaries[documentIndex].lineBoundaries) {
        console.log(x);
      }
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
   * @param {number} documentIndex
   * @param {number} lineIndex
   * @param {number} count
   */
  jump(editor, documentIndex, lineIndex, count) {
    this.documentBoundaries[documentIndex].jump(editor, lineIndex, count);
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
      }
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
BoundaryManager.DefaultSpecialCharactors = "\"'`()[]{}";
BoundaryManager.DefaultMargin = "0ex 0.3ex 0ex 0.7ex";

exports.DocumentBoundary = DocumentBoundary;
exports.BoundaryManager = BoundaryManager;
