var fs = require("fs");
var c = console;
var file = process.argv[2];

var dest = {
    "": 0b000, "M": 0b001, "D": 0b010,
    "MD": 0b011, "A": 0b100, "AM": 0b101,
    "AD": 0b110, "AMD": 0b111
}

var jump = {
    "": 0b000, "JGT": 0b001, "JEQ": 0b010,
    "JGE": 0b011, "JLT": 0b100, "JNE": 0b101,
    "JLE": 0b110, "JMP": 0b111
}

var comp = {
    "0": 0b0101010, "1": 0b0111111, "-1": 0b0111010,
    "D": 0b0001100, "A": 0b0110000, "M": 0b1110000,
    "!D": 0b0001101, "!A": 0b0110001, "!M": 0b1110001,
    "-D": 0b0001111, "-A": 0b0110011, "-M": 0b1110011,
    "D+1": 0b0011111, "A+1": 0b0110111, "M+1": 0b1110111,
    "D-1": 0b0001110, "A-1": 0b0110010, "M-1": 0b1110010,
    "D+A": 0b0000010, "D+M": 0b1000010, "D-A": 0b0010011,
    "D-M": 0b1010011, "A-D": 0b0000111, "M-D": 0b1000111,
    "D&A": 0b0000000, "D&M": 0b1000000, "D|A": 0b0010101,
    "D|M": 0b1010101
}

var symTable = {
    "R0": 0, "R1": 1, "R2": 2,
    "R3": 3, "R4": 4, "R5": 5,
    "R6": 6, "R7": 7, "R8": 8,
    "R9": 9, "R10": 10, "R11": 11,
    "R12": 12, "R13": 13, "R14": 14,
    "R15": 15, "SP": 0, "LCL": 1,
    "ARG": 2, "THIS": 3, "THAT": 4,
    "KBD": 24576, "SCREEN": 16384
};

var symTop = 16; //15以前是固定，所以從16開始

function addSymbol(symbol) {
    symTable[symbol] = symTop;
    symTop++;    //變數+1
}

asm(file + '.asm', file + '.hack');

function asm(asmFile, objFile) {
    var asmText = fs.readFileSync(asmFile, "utf8");

    var lines = asmText.split(/\r?\n/);      //將組合語言分割成一行一行的  

    c.log(JSON.stringify(lines, null, 2));     //印出結果 
    pass1(lines);         //記住所有符號的位址             
    pass2(lines, objFile);      //開始編碼                
}

function parse(line, i) {               //i為了要傳回錯誤訊息          
    line.match(/^([^\/]*)(\/.*)?$/);
    line = RegExp.$1.trim();   //把空白消除
    if (line.length === 0)    //長度為0表示為空白                          
        return null;
    if (line.startsWith("@")) {      //第一個非空行字母是不是"@" 如果是代表為A指令  直接取出數字編碼      
        return { type: "A", arg: line.substring(1).trim() }   //從1以後取出才是符號或位址
    } else if (line.match(/^\(([^\)]+)\)$/)) {
        return { type: "S", symbol: RegExp.$1 }
    } else if (line.match(/^((([AMD]*)=)?([AMD01\+\-\&\|\!]*))(;(\w*))?$/)) {

        return { type: "C", c: RegExp.$4, d: RegExp.$3, j: RegExp.$6 }

    } else {
        throw "Error: line " + (i + 1);
    }
}

function pass1(lines) {
    c.log("============== pass1 ================");
    var address = 0;
    for (var i = 0; i < lines.length; i++) {
        var p = parse(lines[i], i);       //把一行解析出來 解析成哪種形式的指令 每個欄位的值為何
        if (p === null)           //"空行"或"註解"       
            continue;               //回到一開始執行下一行
        if (p.type === "S") {        //符號型態          
            c.log(" symbol: %s %s", p.symbol, intToStr(address, 4, 10));
            symTable[p.symbol] = address; //加到符號表並記住位址
            continue;    //符號不能+1                          
        } else {
            c.log(" p: %j", p);           //印出指令結果        
        }
        c.log("%s:%s %s", intToStr(i + 1, 3, 10), intToStr(address, 4, 10), lines[i]);
        address++;  //不是"空行"也不是"註解" 就要+1
        addSymbol(p.arg, address);
    }
}

function pass2(lines, objFile) {                      //objFile是輸出黨 
    c.log("============== pass2 ================");
    var ws = fs.createWriteStream(objFile);
    ws.once('open', function (fd) {
        var address = 0;
        for (var i = 0; i < lines.length; i++) {
            var p = parse(lines[i], i);
            if (p === null || p.type === "S") continue;   //如果是"空行"或"符號"，continue
            var code = toCode(p);
            c.log("%s:%s %s", intToStr(i + 1, 3, 10), intToStr(code, 16, 2), lines[i]);
            ws.write(intToStr(code, 16, 2) + "\n");

        }
        ws.end();
    });
}

function intToStr(num, size, radix) {

    var s = num.toString(radix) + "";
    while (s.length < size) s = "0" + s;
    return s;
}

function toCode(p) {
    var address;
    if (p.type === "A") {
        if (p.arg.match(/^\d+$/)) {
            address = parseInt(p.arg);  //取出符號位址
        } else {
            address = symTable[p.arg];
        } if (typeof address === 'undefined') {
            address = symTop;  //
            addSymbol(p.arg, address);
        }
        return address;
    } else {
        var d = dest[p.d];
        var c = comp[p.c];
        var j = jump[p.j];
        return 0b111 << 13 | c << 6 | d << 3 | j;

    }
}