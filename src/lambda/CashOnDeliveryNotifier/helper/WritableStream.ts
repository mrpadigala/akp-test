import { Writable } from 'stream';

export default class WritableStream extends Writable {
  chunk: string[] = [];

  public _write(chunk, enc, next) {
    this.chunk.push(chunk.toString());
    next();
  }

  public getData(): string {
    return this.chunk.join('\n');
  }
}
