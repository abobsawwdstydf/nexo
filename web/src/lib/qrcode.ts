const QRCode = (() => {
  const PAD0 = 0xEC;
  const PAD1 = 0x11;

  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP_TABLE[i] = EXP_TABLE[i - 255];
  })();

  function glog(n: number) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return LOG_TABLE[n];
  }

  function gexp(n: number) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP_TABLE[n];
  }

  function getErrorCorrectPolynomial(errorCorrectLength: number) {
    let a = [1];
    for (let i = 0; i < errorCorrectLength; i++) {
      const b = [1, gexp(i)];
      const c = new Array(a.length + b.length - 1);
      for (let j = 0; j < c.length; j++) c[j] = 0;
      for (let j = 0; j < a.length; j++)
        for (let k = 0; k < b.length; k++)
          c[j + k] ^= gexp(glog(a[j]) + glog(b[k]));
      a = c;
    }
    return a;
  }

  function getBCHTypeInfo(data: number) {
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(1335) >= 0) d ^= 1335 << (getBCHDigit(d) - getBCHDigit(1335));
    return ((data << 10) | d) ^ 21522;
  }

  function getBCHDigit(data: number) {
    let digit = 0;
    while (data !== 0) { digit++; data >>>= 1; }
    return digit;
  }

  function getPatternPosition(typeNumber: number) {
    return [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
      [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
      [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
      [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ][typeNumber - 1];
  }

  // EC Table: [totalCodewords, ecCodewords, numBlocks, dataCodewordsPerBlock]
  const EC_TABLE: Record<string, [number, number, number, number][]> = {
    '1-L': [[19, 7, 1, 19]], '1-M': [[16, 10, 1, 16]], '1-Q': [[13, 13, 1, 13]], '1-H': [[9, 17, 1, 9]],
    '2-L': [[34, 10, 1, 34]], '2-M': [[28, 16, 1, 28]], '2-Q': [[22, 22, 1, 22]], '2-H': [[16, 28, 1, 16]],
    '3-L': [[55, 15, 1, 55]], '3-M': [[44, 26, 1, 44]], '3-Q': [[34, 18, 2, 17]], '3-H': [[26, 22, 2, 13]],
    '4-L': [[80, 20, 1, 80]], '4-M': [[64, 18, 2, 32]], '4-Q': [[48, 26, 2, 24]], '4-H': [[36, 16, 4, 9]],
    '5-L': [[108, 26, 1, 108]], '5-M': [[86, 24, 2, 43]], '5-Q': [[62, 18, 2, 15], [62, 18, 2, 15]], '5-H': [[46, 22, 2, 11], [46, 22, 2, 11]],
    '6-L': [[136, 18, 2, 68]], '6-M': [[108, 16, 4, 27]], '6-Q': [[76, 24, 4, 19]], '6-H': [[60, 28, 4, 15]],
    '7-L': [[156, 20, 2, 78]], '7-M': [[124, 18, 4, 31]], '7-Q': [[88, 18, 2, 14], [88, 18, 4, 14]], '7-H': [[66, 26, 4, 13], [66, 26, 1, 13]],
    '8-L': [[194, 24, 2, 97]], '8-M': [[154, 22, 2, 38], [154, 22, 2, 38]], '8-Q': [[110, 22, 4, 18], [110, 22, 2, 18]], '8-H': [[86, 26, 4, 14], [86, 26, 2, 14]],
    '9-L': [[232, 30, 2, 116]], '9-M': [[182, 22, 3, 36], [182, 22, 2, 36]], '9-Q': [[132, 20, 4, 16], [132, 20, 4, 16]], '9-H': [[100, 24, 4, 12], [100, 24, 4, 12]],
    '10-L': [[274, 18, 2, 68], [274, 18, 2, 68]], '10-M': [[216, 26, 4, 43], [216, 26, 1, 43]], '10-Q': [[154, 24, 6, 19], [154, 24, 2, 19]], '10-H': [[122, 28, 6, 15], [122, 28, 2, 15]],
  };

  function getRSBlocks(typeNumber: number, errorCorrectLevel: string) {
    const key = `${typeNumber}-${errorCorrectLevel}`;
    const blocks = EC_TABLE[key];
    if (!blocks) {
      const total = typeNumber * 4 + 8;
      return [{ totalCodewords: total, dataCodewords: Math.floor(total * 0.7), ecCodewords: Math.floor(total * 0.3), count: 1 }];
    }
    return blocks.map(([total, ec, count, data]) => ({
      totalCodewords: total,
      dataCodewords: data,
      ecCodewords: ec,
      count,
    }));
  }

  interface RSBlock {
    totalCodewords: number;
    dataCodewords: number;
    ecCodewords: number;
    count: number;
  }

  function createData(typeNumber: number, errorCorrectLevel: string, dataBytes: Uint8Array) {
    const rsBlocks = getRSBlocks(typeNumber, errorCorrectLevel) as RSBlock[];
    const totalDataCount = rsBlocks.reduce((sum, b) => sum + b.dataCodewords * b.count, 0);

    // Build bit stream
    const bits: number[] = [];

    // Mode indicator: byte mode = 0100
    bits.push(0, 1, 0, 0);

    // Character count indicator
    const lenBits = typeNumber <= 9 ? 8 : 16;
    for (let i = lenBits - 1; i >= 0; i--) {
      bits.push((dataBytes.length >> i) & 1);
    }

    // Data bytes
    for (const byte of dataBytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((byte >> i) & 1);
      }
    }

    // Terminator (up to 4 zeros)
    const terminatorLen = Math.min(4, totalDataCount * 8 - bits.length);
    for (let i = 0; i < terminatorLen; i++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Convert to bytes
    const dataBytesPadded = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < dataBytesPadded.length; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] || 0);
      dataBytesPadded[i] = b;
    }

    // Pad bytes to fill capacity
    const padBytes = [PAD0, PAD1];
    let padIdx = 0;
    const final = new Uint8Array(totalDataCount);
    final.set(dataBytesPadded);
    let pos = dataBytesPadded.length;
    while (pos < totalDataCount) {
      final[pos] = padBytes[padIdx % 2];
      padIdx++;
      pos++;
    }

    return encodeData(final, rsBlocks);
  }

  function encodeData(data: Uint8Array, rsBlocks: RSBlock[]) {
    // Split data into blocks
    const blocks: Uint8Array[] = [];
    let offset = 0;
    for (const block of rsBlocks) {
      for (let i = 0; i < block.count; i++) {
        blocks.push(data.slice(offset, offset + block.dataCodewords));
        offset += block.dataCodewords;
      }
    }

    // Generate EC for each block
    const ecBlocks: Uint8Array[] = [];
    const ecLen = rsBlocks[0].ecCodewords;
    const genPoly = getErrorCorrectPolynomial(ecLen);
    for (const block of blocks) {
      const mod = new Uint8Array(block.length + ecLen);
      mod.set(block);
      for (let i = 0; i < block.length; i++) {
        const lead = mod[i];
        if (lead !== 0) {
          const logLead = glog(lead);
          for (let j = 0; j < genPoly.length; j++) {
            mod[i + j] ^= gexp(glog(genPoly[j]) + logLead);
          }
        }
      }
      ecBlocks.push(mod.slice(block.length));
    }

    // Interleave data blocks
    const result: number[] = [];
    const maxDataLen = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (const block of blocks) {
        if (i < block.length) result.push(block[i]);
      }
    }

    // Interleave EC blocks
    for (let i = 0; i < ecLen; i++) {
      for (const ec of ecBlocks) {
        result.push(ec[i]);
      }
    }

    return new Uint8Array(result);
  }

  function createQRCode(text: string, options: { width?: number; margin?: number; color?: { dark: string; light: string }; errorCorrectionLevel?: string } = {}) {
    const { width = 280, margin = 2, color = { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel = 'M' } = options;

    const bytes = new TextEncoder().encode(text);

    // Find minimum type number that fits the data
    let typeNumber = 1;
    for (let t = 1; t <= 10; t++) {
      const key = `${t}-${errorCorrectionLevel}`;
      const blocks = EC_TABLE[key];
      if (!blocks) continue;
      const totalData = blocks.reduce((sum, b) => sum + b[3] * b[2], 0); // dataCodewords * count
      // Byte mode: 4 bits mode + lenBits bits length + data*8 bits
      const lenBits = t <= 9 ? 8 : 16;
      const totalBits = 4 + lenBits + bytes.length * 8;
      if (totalBits <= totalData * 8) {
        typeNumber = t;
        break;
      }
      if (t === 10) typeNumber = 10;
    }

    const size = typeNumber * 4 + 17;
    const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

    function setModule(r: number, c: number, val: boolean) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        modules[r][c] = val;
        reserved[r][c] = true;
      }
    }

    function setFinderPattern(row: number, col: number) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const mr = row + r, mc = col + c;
          if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
          const inOuter = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(mr, mc, inOuter || inInner);
        }
      }
    }

    setFinderPattern(0, 0);
    setFinderPattern(0, size - 7);
    setFinderPattern(size - 7, 0);

    // Alignment patterns
    const alignPos = getPatternPosition(typeNumber);
    for (const ar of alignPos) {
      for (const ac of alignPos) {
        if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 8) || (ar >= size - 8 && ac <= 8)) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            setModule(ar + r, ac + c, Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
      if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
    }

    setModule(size - 8, 8, true);

    // Reserve format info areas
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) reserved[8][i] = true;
      if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
      if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
    }

    // Encode data
    const data = createData(typeNumber, errorCorrectionLevel, bytes);

    // Place data modules
    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;
      for (let row = upward ? size - 1 : 0; upward ? row >= 0 : row < size; upward ? row-- : row++) {
        for (let c = 0; c < 2; c++) {
          const mc = col - c;
          if (mc < 0 || mc >= size || reserved[row][mc]) continue;
          modules[row][mc] = bitIdx < data.length * 8
            ? ((data[Math.floor(bitIdx / 8)] >> (7 - (bitIdx % 8))) & 1) === 1
            : false;
          bitIdx++;
        }
      }
      upward = !upward;
    }

    // Apply mask patterns and select best
    const maskPatterns = [
      (r: number, c: number) => (r + c) % 2 === 0,
      (r: number, c: number) => r % 2 === 0,
      (r: number, c: number) => c % 3 === 0,
      (r: number, c: number) => (r + c) % 3 === 0,
      (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r: number, c: number) => (r * c) % 2 + (r * c) % 3 === 0,
      (r: number, c: number) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
      (r: number, c: number) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
    ];

    let bestMask = 0;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const test = modules.map(r => [...r]);
      const fn = maskPatterns[mask];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!reserved[r][c] && fn(r, c)) test[r][c] = !test[r][c];
        }
      }

      const fmtInfo = getBCHTypeInfo((4 << 3) | mask);
      for (let i = 0; i < 15; i++) {
        const bit = ((fmtInfo >> i) & 1) === 1;
        if (i < 6) test[i][8] = bit;
        else if (i < 8) test[i + 1][8] = bit;
        else test[size - 15 + i][8] = bit;
        if (i < 8) test[8][size - 1 - i] = bit;
        else if (i < 9) test[8][15 - i - 1 + 1] = bit;
        else test[8][14 - i] = bit;
      }
      test[size - 8][8] = true;

      let penalty = 0;
      for (let r = 0; r < size; r++) {
        let count = 1;
        for (let c = 1; c < size; c++) {
          if (test[r][c] === test[r][c - 1]) {
            count++;
            if (count === 5) penalty += 3;
            else if (count > 5) penalty++;
          } else count = 1;
        }
      }
      for (let c = 0; c < size; c++) {
        let count = 1;
        for (let r = 1; r < size; r++) {
          if (test[r][c] === test[r - 1][c]) {
            count++;
            if (count === 5) penalty += 3;
            else if (count > 5) penalty++;
          } else count = 1;
        }
      }
      if (penalty < bestPenalty) { bestPenalty = penalty; bestMask = mask; }
    }

    // Apply best mask
    const maskFn = maskPatterns[bestMask];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && maskFn(r, c)) modules[r][c] = !modules[r][c];
      }
    }

    // Write format info
    const fmtInfo = getBCHTypeInfo((4 << 3) | bestMask);
    for (let i = 0; i < 15; i++) {
      const bit = ((fmtInfo >> i) & 1) === 1;
      if (i < 6) modules[i][8] = bit;
      else if (i < 8) modules[i + 1][8] = bit;
      else modules[size - 15 + i][8] = bit;
      if (i < 8) modules[8][size - 1 - i] = bit;
      else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
      else modules[8][14 - i] = bit;
    }
    modules[size - 8][8] = true;

    // Render to canvas
    const canvas = document.createElement('canvas');
    const moduleSize = Math.floor(width / (size + margin * 2));
    const actualSize = moduleSize * (size + margin * 2);
    canvas.width = actualSize;
    canvas.height = actualSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = color.light;
    ctx.fillRect(0, 0, actualSize, actualSize);
    ctx.fillStyle = color.dark;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) {
          ctx.fillRect((c + margin) * moduleSize, (r + margin) * moduleSize, moduleSize, moduleSize);
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  return { toDataURL: createQRCode };
})();

export default QRCode;
