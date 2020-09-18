import IOrderV3 from './IOrderV3';

export default interface IOrderV3Layer extends IOrderV3 {
  MenaHeldReasons: string[];
  MenaHeldContactAttempts: number;
  Email?: string;
}
