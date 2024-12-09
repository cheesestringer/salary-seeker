import type { PlasmoCSConfig, PlasmoGetInlineAnchor, PlasmoGetStyle } from 'plasmo';
import { Seek } from '~components/seek';

export const config: PlasmoCSConfig = {
  matches: ['https://www.seek.com.au/*', 'https://www.seek.co.nz/*']
};

// Inline the stylesheets since css files currently get bundled in to content scripts as resources
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style');
  style.textContent = `
    #plasmo-shadow-container {
      z-index: 1 !important;
    }
    .container {
      display: flex;
      align-items: center;
      margin-top: 12px;
      font-family: SeekSans, "SeekSans Fallback", Arial, Tahoma, sans-serif;
    }
    .logo {
      height: 40px;
    }
    span {
      padding-left: 5px;
    }
    .message {
      font-size: 15px;
    }
    .price {
      font-size: 18px;
      font-weight: 600;
    }
  `;
  return style;
};

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const element = document.querySelector('[data-automation="advertiser-name"]')?.parentElement?.parentElement;
  return {
    element: element,
    insertPosition: 'afterend'
  };
};

const SeekJob = ({ anchor }) => <Seek anchor={anchor} />;

export default SeekJob;
