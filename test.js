var vex = require("./index");
var arr = [1, 27, 0, 0, 0, 0, 0, 0, 333, 4, 200000];
var out = vex.encode(arr);

console.log(out);
console.log(vex.decode(out));

var compressedOut = vex.encodeCompressed(arr);
console.log(compressedOut);
console.log(vex.decode(compressedOut));

// Sample pre-encoded array
var test = new Uint8Array(6);
test[0] = 0x1C;
test[1] = 3;
test[2] = 7;
test[3] = 0xFF;
test[4] = 0;
test[5] = 15;

console.log(vex.decode(test));