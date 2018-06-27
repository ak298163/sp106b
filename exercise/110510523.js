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

var symTop = 16; //15�H�e�O�T�w�A�ҥH�q16�}�l

function addSymbol(symbol) {
    symTable[symbol] = symTop;
    symTop++;    //�ܼ�+1
}

asm(file + '.asm', file + '.hack');

function asm(asmFile, objFile) {
    var asmText = fs.readFileSync(asmFile, "utf8");

    var lines = asmText.split(/\r?\n/);      //�N�զX�y�����Φ��@��@�檺  

    c.log(JSON.stringify(lines, null, 2));     //�L�X���G 
    pass1(lines);         //�O��Ҧ��Ÿ�����}             
    pass2(lines, objFile);      //�}�l�s�X                
}

function parse(line, i) {               //i���F�n�Ǧ^���~�T��          
    line.match(/^([^\/]*)(\/.*)?$/);
    line = RegExp.$1.trim();   //��ťծ���
    if (line.length === 0)    //���׬�0��ܬ��ť�                          
        return null;
    if (line.startsWith("@")) {      //�Ĥ@�ӫD�Ŧ�r���O���O"@" �p�G�O�N��A���O  �������X�Ʀr�s�X      
        return { type: "A", arg: line.substring(1).trim() }   //�q1�H����X�~�O�Ÿ��Φ�}
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
        var p = parse(lines[i], i);       //��@��ѪR�X�� �ѪR�����اΦ������O �C����쪺�Ȭ���
        if (p === null)           //"�Ŧ�"��"����"       
            continue;               //�^��@�}�l����U�@��
        if (p.type === "S") {        //�Ÿ����A          
            c.log(" symbol: %s %s", p.symbol, intToStr(address, 4, 10));
            symTable[p.symbol] = address; //�[��Ÿ���ðO���}
            continue;    //�Ÿ�����+1                          
        } else {
            c.log(" p: %j", p);           //�L�X���O���G        
        }
        c.log("%s:%s %s", intToStr(i + 1, 3, 10), intToStr(address, 4, 10), lines[i]);
        address++;  //���O"�Ŧ�"�]���O"����" �N�n+1
        addSymbol(p.arg, address);
    }
}

function pass2(lines, objFile) {                      //objFile�O��X�� 
    c.log("============== pass2 ================");
    var ws = fs.createWriteStream(objFile);
    ws.once('open', function (fd) {
        var address = 0;
        for (var i = 0; i < lines.length; i++) {
            var p = parse(lines[i], i);
            if (p === null || p.type === "S") continue;   //�p�G�O"�Ŧ�"��"�Ÿ�"�Acontinue
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
            address = parseInt(p.arg);  //���X�Ÿ���}
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