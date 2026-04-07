const fs = require('fs');

class DiskLinkedList {
  constructor(filePath) {
    this.filePath = filePath;
    this.nodeSize = 32; // 24 bytes for data + 8 bytes for 'next' offset
    this.headerSize = 8; // Pointer to the head node

    if (!fs.existsSync(this.filePath)) {
      // Initialize file with a null head pointer (-1)
      const buf = Buffer.alloc(this.headerSize);
      buf.writeBigInt64LE(-1n, 0);
      fs.writeFileSync(this.filePath, buf);
    }
  }

  append(data) {
    const fd = fs.openSync(this.filePath, 'r+');
    const headBuf = Buffer.alloc(this.headerSize);
    fs.readSync(fd, headBuf, 0, this.headerSize, 0);
    let headOffset = headBuf.readBigInt64LE(0);

    const newNodeOffset = BigInt(fs.statSync(this.filePath).size);
    const newNodeBuf = Buffer.alloc(this.nodeSize);
    newNodeBuf.write(data.substring(0, 24), 0); // Max 24 chars data
    newNodeBuf.writeBigInt64LE(-1n, 24); // Next = null

    if (headOffset === -1n) {
      // First node: update header
      const newHeadBuf = Buffer.alloc(this.headerSize);
      newHeadBuf.writeBigInt64LE(newNodeOffset, 0);
      fs.writeSync(fd, newHeadBuf, 0, this.headerSize, 0);
    } else {
      // Traverse to find the tail
      let currentOffset = headOffset;
      let nextOffset;
      const ptrBuf = Buffer.alloc(8);

      while (true) {
        fs.readSync(fd, ptrBuf, 0, 8, Number(currentOffset) + 24);
        nextOffset = ptrBuf.readBigInt64LE(0);
        if (nextOffset === -1n) break;
        currentOffset = nextOffset;
      }

      // Point old tail to new node
      ptrBuf.writeBigInt64LE(newNodeOffset, 0);
      fs.writeSync(fd, ptrBuf, 0, 8, Number(currentOffset) + 24);
    }

    // Write the actual new node at the end
    fs.writeSync(fd, newNodeBuf, 0, this.nodeSize, Number(newNodeOffset));
    fs.closeSync(fd);
  }

  * traverse() {
    const fd = fs.openSync(this.filePath, 'r');
    const buf = Buffer.alloc(this.nodeSize);
    const headBuf = Buffer.alloc(this.headerSize);
    
    fs.readSync(fd, headBuf, 0, this.headerSize, 0);
    let currentOffset = headBuf.readBigInt64LE(0);

    while (currentOffset !== -1n) {
      fs.readSync(fd, buf, 0, this.nodeSize, Number(currentOffset));
      const data = buf.toString('utf8', 0, 24).replace(/\0/g, '');
      yield data;
      currentOffset = buf.readBigInt64LE(24);
    }
    fs.closeSync(fd);
  }
}

// Usage
const list = new DiskLinkedList('list.db');
list.append("Hello");
list.append("World");

for (const val of list.traverse()) {
  console.log(val);
}
