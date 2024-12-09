import { oneDayInMs } from '~constants';

export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

export const toCurrencyFormat = (value: number, locale = 'en-AU', currency = 'AUD') => {
  return value.toLocaleString(locale, { style: 'currency', currency, minimumFractionDigits: 0 });
};

export const getRangeFormat = (min: number, max: number) => {
  const minimum = min ? `${toCurrencyFormat(min)} -` : 'Up to';
  return `${minimum} ${toCurrencyFormat(max)}`;
};

export const getMiddle = (lower: number, upper: number) => {
  return Math.round((lower + upper) / 2);
};

export const buggerAllChange = (first: number, second: number) => {
  return (first / second) * 100 > 99.6;
};

export const roundUp = (value: number) => {
  return Math.round(value / 1000) * 1000;
};

export const roundDown = (value: number) => {
  return Math.floor(value / 1000) * 1000;
};
