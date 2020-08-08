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
   * @returns {{boundaries: {shortValue: string, start: number, length: number}[],
   *    stringInfos:{ start: number, string: string }[]}}
   */
  static scanSpecialCharacter(line, SpecialRegex) {
    const ret = { boundaries: [], stringInfos: [{ start: 0, string: line }] };
    if (SpecialRegex === null) {
      return ret;
    }
    const boundaries = DocumentBoundary.scan(line, [SpecialRegex]);
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
   * @returns {{shortValue:string, start:number, length:number}[]}
   */
  scanLine(line) {
    let { boundaries, stringInfos } = DocumentBoundary.scanSpecialCharacter(line, this.SpecialRegex);
    for (const stringInfo of stringInfos) {
      boundaries.push(
        ...DocumentBoundary.scan(stringInfo.string, DocumentBoundary.GeneralCategory, stringInfo.start, this.Japanese)
      );
    }
    boundaries.sort(DocumentBoundary.sorter);
    boundaries.push(DocumentBoundary.getBoundary("EOL", line.length, 0));
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
   * @param {vscode.TextDocument} document
   * @param {{ start: number; end: number; }} lineIndex
   */
  changeLines(document, lineIndex) {
    for (let i = lineIndex.start; i < document.lineCount && i <= lineIndex.end; ++i) {
      this.lineBoundaries[i] = this.scanLine(document.lineAt(i).text);
    }
  }

  /**
   * @param {number} diff
   * @param {number} lineIndex
   */
  modify(diff, lineIndex) {
    if (diff > 0) {
      this.lineBoundaries.splice(lineIndex, 0, ...new Array(diff));
    } else if (diff < 0) {
      this.lineBoundaries.splice(lineIndex, diff * -1);
    }
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
}

// GeneralCategoryのどれにも当てはまらないものは存在するのか?
// 排他的
DocumentBoundary.GeneralCategory = [
  { shortValue: "Cc", longValue: "Control", regex: /\p{Cc}+/gu },
  { shortValue: "Cf", longValue: "Format", regex: /\p{Cf}+/gu },
  { shortValue: "Cn", longValue: "Unassigned", regex: /\p{Cn}+/gu },
  { shortValue: "Co", longValue: "Private_Use", regex: /\p{Co}+/gu },
  { shortValue: "Cs", longValue: "Surrogate", regex: /\p{Cs}+/gu },
  //{ shortValue: "C", longValue: "Other" , regex: /\p{C}+/ug},
  //{ shortValue: "LC", longValue: "Cased_Letter" , regex: /\p{LC}+/ug},
  { shortValue: "Ll", longValue: "Lowercase_Letter", regex: /\p{Ll}+/gu },
  { shortValue: "Lm", longValue: "Modifier_Letter", regex: /\p{Lm}+/gu },
  { shortValue: "Lo", longValue: "Other_Letter", regex: /\p{Lo}+/gu }, //漢字片仮名平仮名は全てLo
  { shortValue: "Lt", longValue: "Titlecase_Letter", regex: /\p{Lt}+/gu },
  { shortValue: "Lu", longValue: "Uppercase_Letter", regex: /\p{Lu}+/gu },
  //{ shortValue: "L", longValue: "Letter" , regex: /\p{L}+/ug},
  { shortValue: "Mc", longValue: "Spacing_Mark", regex: /\p{Mc}+/gu },
  { shortValue: "Me", longValue: "Enclosing_Mark", regex: /\p{Me}+/gu },
  { shortValue: "Mn", longValue: "Nonspacing_Mark", regex: /\p{Mn}+/gu },
  //{ shortValue: "M", longValue: "Mark" , regex: /\p{M}+/ug},
  { shortValue: "Nd", longValue: "Decimal_Number", regex: /\p{Nd}+/gu },
  { shortValue: "Nl", longValue: "Letter_Number", regex: /\p{Nl}+/gu },
  { shortValue: "No", longValue: "Other_Number", regex: /\p{No}+/gu },
  //{ shortValue: "N", longValue: "Number" , regex: /\p{N}+/ug},
  { shortValue: "Pc", longValue: "Connector_Punctuation", regex: /\p{Pc}+/gu },
  { shortValue: "Pd", longValue: "Dash_Punctuation", regex: /\p{Pd}+/gu },
  { shortValue: "Pe", longValue: "Close_Punctuation", regex: /\p{Pe}+/gu },
  { shortValue: "Pf", longValue: "Final_Punctuation", regex: /\p{Pf}+/gu },
  { shortValue: "Pi", longValue: "Initial_Punctuation", regex: /\p{Pi}+/gu },
  { shortValue: "Po", longValue: "Other_Punctuation", regex: /\p{Po}+/gu }, // "'、。も同じ
  { shortValue: "Ps", longValue: "Open_Punctuation", regex: /\p{Ps}+/gu },
  //{ shortValue: "P", longValue: "Punctuation" , regex: /\p{P}+/ug},
  { shortValue: "Sc", longValue: "Currency_Symbol", regex: /\p{Sc}+/gu },
  { shortValue: "Sk", longValue: "Modifier_Symbol", regex: /\p{Sk}+/gu },
  { shortValue: "Sm", longValue: "Math_Symbol", regex: /\p{Sm}+/gu },
  { shortValue: "So", longValue: "Other_Symbol", regex: /\p{So}+/gu },
  //{ shortValue: "S", longValue: "Symbol" , regex: /\p{S}+/ug},
  { shortValue: "Zl", longValue: "Line_Separator", regex: /\p{Zl}+/gu },
  { shortValue: "Zp", longValue: "Paragraph_Separator", regex: /\p{Zp}+/gu },
  { shortValue: "Zs", longValue: "Space_Separator", regex: /\p{Zs}+/gu },
  //{ shortValue: "Z", longValue: "Separator" , regex: /\p{Z}+/ug},
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

  /**
   * @param {number} diff
   * @param {number} documentIndex
   * @param {number} lineIndex
   */
  modify(diff, documentIndex, lineIndex) {
    if (diff !== 0) {
      this.documentBoundaries[documentIndex].modify(diff, lineIndex);
    }
  }

  /**
   * @param {vscode.TextDocumentChangeEvent} event
   * もう少し効率よくしたい
   */
  change(event) {
    if (BoundaryManager.checkScheme(event.document.uri.scheme) === false || event.contentChanges.length === 0) {
      return;
    }

    const index = this.find(event.document.uri);
    if (index === -1) {
      this.add(event.document);
      return;
    }

    let statusBar = vscode.window.setStatusBarMessage(BoundaryManager.ScanMessage);
    const lineIndex = { start: 0, end: 0 };
    let diff = 0;
    for (const change of event.contentChanges) {
      lineIndex.start = event.document.positionAt(change.rangeOffset).line;
      lineIndex.end = event.document.positionAt(change.rangeOffset + change.rangeLength).line;
      diff = event.document.lineCount - this.documentBoundaries[index].lineBoundaries.length;
      this.modify(diff, index, lineIndex.start);
      if (diff > 0) {
        lineIndex.end += diff;
      }
      this.documentBoundaries[index].changeLines(event.document, lineIndex);
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
        textContent: lineString + vscodeUtil.convertToString(count),
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
      decorationRanges.push(this.getLineDecorationRanges(documentIndex, i + start, vscodeUtil.convertToString(i)));
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
  static compare(obj, target, index, left, right, _type = "") {
    const v = vscodeUtil.convertToNumber(obj.textContent);
    //const n = vscodeUtil.convertToNumber(target);
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
    const target = vscodeUtil.convertToNumber(textContent);
    let min = 0;
    let max = 0;
    let index = 0;
    for (const lineDecorationRanges of decorationRanges) {
      min = vscodeUtil.convertToNumber(lineDecorationRanges[0].textContent);
      max = vscodeUtil.convertToNumber(lineDecorationRanges[lineDecorationRanges.length - 1].textContent);
      if (target >= min && target <= max) {
        index = DocumentBoundary.search(lineDecorationRanges, target, "eq", BoundaryManager.compare);
        if (index !== -1) {
          return { lineIndex: lineDecorationRanges[index].lineIndex, count: lineDecorationRanges[index].index };
        }
      }
    }
    return null;
  }

  // uris() {
  //   const result = [];
  //   for (const cb of this.characterBoundaries) {
  //     result.push(cb.uri);
  //   }
  //   console.log(result);
  //   return result;
  // }

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
BoundaryManager.DefaultSpecialCharactors = "\"'`";
BoundaryManager.DefaultMargin = "0ex 0.3ex 0ex 0.7ex";

exports.DocumentBoundary = DocumentBoundary;
exports.BoundaryManager = BoundaryManager;
