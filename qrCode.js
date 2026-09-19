// Minimal QR Code generator for short install URLs.
// Produces a boolean module matrix for a Version 7 / Error Correction L QR code.
// No runtime dependency is required.

const VERSION = 7;
const SIZE = 21 + (VERSION - 1) * 4; // 45
const DATA_CODEWORDS = 156;
const BLOCK_COUNT = 2;
const DATA_PER_BLOCK = 78;
const ECC_PER_BLOCK = 20;
const ALIGNMENT = [6, 22, 38];

function gfTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
}

const GF = gfTables();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return out;
}

function rsGenerator(degree) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) result = polyMul(result, [1, GF.exp[i]]);
  return result;
}

const RS_GEN = rsGenerator(ECC_PER_BLOCK);

function rsRemainder(data) {
  const result = new Array(ECC_PER_BLOCK).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ECC_PER_BLOCK; i += 1) result[i] ^= gfMul(RS_GEN[i + 1], factor);
    }
  }
  return result;
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push(((value >>> i) & 1) !== 0);
}

function createCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 154) throw new Error('QR_URL_TOO_LONG');

  const bits = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, 8); // version 1-9 byte count
  for (const byte of bytes) pushBits(bits, byte, 8);

  const capacityBits = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacityBits - bits.length); i += 1) bits.push(false);
  while (bits.length % 8 !== 0) bits.push(false);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | (bits[i + j] ? 1 : 0);
    data.push(value);
  }
  let pad = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
    pad += 1;
  }

  const blocks = [];
  for (let i = 0; i < BLOCK_COUNT; i += 1) {
    const block = data.slice(i * DATA_PER_BLOCK, (i + 1) * DATA_PER_BLOCK);
    blocks.push({ data: block, ecc: rsRemainder(block) });
  }

  const codewords = [];
  for (let i = 0; i < DATA_PER_BLOCK; i += 1) {
    for (const block of blocks) codewords.push(block.data[i]);
  }
  for (let i = 0; i < ECC_PER_BLOCK; i += 1) {
    for (const block of blocks) codewords.push(block.ecc[i]);
  }
  return codewords;
}

function blankMatrix() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
}
function blankReserved() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
}
function setFunction(matrix, reserved, row, col, value) {
  if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return;
  matrix[row][col] = value;
  reserved[row][col] = true;
}

function addFinder(matrix, reserved, top, left) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const row = top + dy;
      const col = left + dx;
      if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const black = inside && (
        dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
      );
      setFunction(matrix, reserved, row, col, black);
    }
  }
}

function addAlignment(matrix, reserved, centerRow, centerCol) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunction(matrix, reserved, centerRow + dy, centerCol + dx, dist !== 1);
    }
  }
}

function reserveFormat(matrix, reserved) {
  for (let i = 0; i < 15; i += 1) {
    let row;
    let col;
    if (i < 6) row = i;
    else if (i < 8) row = i + 1;
    else row = SIZE - 15 + i;
    col = 8;
    setFunction(matrix, reserved, row, col, false);

    row = 8;
    if (i < 8) col = SIZE - i - 1;
    else if (i < 9) col = 15 - i;
    else col = 15 - i - 1;
    setFunction(matrix, reserved, row, col, false);
  }
  setFunction(matrix, reserved, SIZE - 8, 8, true); // fixed dark module
}

function bchRemainder(value, polynomial) {
  let polyDegree = 0;
  for (let x = polynomial; x > 0; x >>>= 1) polyDegree += 1;
  let v = value;
  while (true) {
    let degree = 0;
    for (let x = v; x > 0; x >>>= 1) degree += 1;
    if (degree < polyDegree) break;
    v ^= polynomial << (degree - polyDegree);
  }
  return v;
}

function versionBits() {
  const value = VERSION << 12;
  return value | bchRemainder(value, 0x1f25);
}

function reserveVersion(matrix, reserved) {
  for (let i = 0; i < 18; i += 1) {
    const aRow = Math.floor(i / 3);
    const aCol = i % 3 + SIZE - 11;
    const bRow = i % 3 + SIZE - 11;
    const bCol = Math.floor(i / 3);
    setFunction(matrix, reserved, aRow, aCol, false);
    setFunction(matrix, reserved, bRow, bCol, false);
  }
}

function drawVersion(matrix) {
  const bits = versionBits();
  for (let i = 0; i < 18; i += 1) {
    const bit = ((bits >>> i) & 1) !== 0;
    matrix[Math.floor(i / 3)][i % 3 + SIZE - 11] = bit;
    matrix[i % 3 + SIZE - 11][Math.floor(i / 3)] = bit;
  }
}

function formatBits(mask) {
  // Error correction level L has format indicator 01.
  const data = (1 << 3) | mask;
  const value = data << 10;
  return (value | bchRemainder(value, 0x537)) ^ 0x5412;
}

function drawFormat(matrix, mask) {
  const bits = formatBits(mask);
  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >>> i) & 1) !== 0;

    let row;
    if (i < 6) row = i;
    else if (i < 8) row = i + 1;
    else row = SIZE - 15 + i;
    matrix[row][8] = bit;

    let col;
    if (i < 8) col = SIZE - i - 1;
    else if (i < 9) col = 15 - i;
    else col = 15 - i - 1;
    matrix[8][col] = bit;
  }
  matrix[SIZE - 8][8] = true;
}

function addFunctionPatterns() {
  const matrix = blankMatrix();
  const reserved = blankReserved();
  addFinder(matrix, reserved, 0, 0);
  addFinder(matrix, reserved, 0, SIZE - 7);
  addFinder(matrix, reserved, SIZE - 7, 0);

  for (let i = 8; i < SIZE - 8; i += 1) {
    setFunction(matrix, reserved, 6, i, i % 2 === 0);
    setFunction(matrix, reserved, i, 6, i % 2 === 0);
  }

  for (const row of ALIGNMENT) {
    for (const col of ALIGNMENT) {
      const overlapsFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === SIZE - 7) ||
        (row === SIZE - 7 && col === 6);
      if (overlapsFinder) continue;
      addAlignment(matrix, reserved, row, col);
    }
  }

  reserveFormat(matrix, reserved);
  reserveVersion(matrix, reserved);
  return { matrix, reserved };
}

function maskBit(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return ((((row * col) % 2) + ((row * col) % 3)) % 2) === 0;
    case 7: return ((((row + col) % 2) + ((row * col) % 3)) % 2) === 0;
    default: return false;
  }
}

function placeData(baseMatrix, reserved, codewords, mask) {
  const matrix = baseMatrix.map((row) => row.slice());
  const bits = [];
  for (const byte of codewords) pushBits(bits, byte, 8);

  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < SIZE; vert += 1) {
      const row = upward ? SIZE - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : false;
        matrix[row][col] = bit !== maskBit(mask, row, col);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  drawFormat(matrix, mask);
  drawVersion(matrix);
  return matrix;
}

function penalty(matrix) {
  let score = 0;

  // Runs in rows and columns.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      let runColor = null;
      let runLength = 0;
      for (let j = 0; j < SIZE; j += 1) {
        const value = pass === 0 ? matrix[i][j] : matrix[j][i];
        if (value === runColor) runLength += 1;
        else {
          if (runLength >= 5) score += 3 + (runLength - 5);
          runColor = value;
          runLength = 1;
        }
      }
      if (runLength >= 5) score += 3 + (runLength - 5);
    }
  }

  // 2x2 blocks.
  for (let r = 0; r < SIZE - 1; r += 1) {
    for (let c = 0; c < SIZE - 1; c += 1) {
      const v = matrix[r][c];
      if (matrix[r][c + 1] === v && matrix[r + 1][c] === v && matrix[r + 1][c + 1] === v) score += 3;
    }
  }

  // Finder-like 1:1:3:1:1 patterns with four white modules on either side.
  const patterns = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      for (let j = 0; j <= SIZE - 11; j += 1) {
        const seq = [];
        for (let k = 0; k < 11; k += 1) seq.push(pass === 0 ? matrix[i][j + k] : matrix[j + k][i]);
        if (patterns.some((p) => p.every((v, k) => v === seq[k]))) score += 40;
      }
    }
  }

  let dark = 0;
  for (const row of matrix) for (const v of row) if (v) dark += 1;
  const total = SIZE * SIZE;
  const percent = (dark * 100) / total;
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

export function createQrMatrix(text) {
  const codewords = createCodewords(text);
  const { matrix: baseMatrix, reserved } = addFunctionPatterns();
  let best = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = placeData(baseMatrix, reserved, codewords, mask);
    const p = penalty(matrix);
    if (p < bestPenalty) {
      best = matrix;
      bestPenalty = p;
    }
  }
  return best;
}

export function drawQrToCanvas(ctx, matrix, x, y, size, options = {}) {
  const quiet = options.quiet ?? 4;
  const background = options.background ?? '#ffffff';
  const foreground = options.foreground ?? '#111111';
  const total = matrix.length + quiet * 2;
  const moduleSize = Math.floor(size / total);
  const actual = moduleSize * total;
  const offsetX = x + Math.floor((size - actual) / 2);
  const offsetY = y + Math.floor((size - actual) / 2);

  ctx.fillStyle = background;
  ctx.fillRect(offsetX, offsetY, actual, actual);
  ctx.fillStyle = foreground;
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (!matrix[row][col]) continue;
      ctx.fillRect(offsetX + (col + quiet) * moduleSize, offsetY + (row + quiet) * moduleSize, moduleSize, moduleSize);
    }
  }
}
