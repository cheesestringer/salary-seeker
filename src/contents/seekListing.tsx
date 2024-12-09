import type { PlasmoCSConfig, PlasmoCSUIProps, PlasmoGetInlineAnchorList, PlasmoGetStyle } from 'plasmo';
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
      font-family: SeekSans, "SeekSans Fallback", Arial, Tahoma, sans-serif;
    }
    .logo {
      height: 40px;
    }
    span {
      padding-left: 5px;
    }
    .message {
      font-size: 16px;
    }
    .price {
      font-size: 18px;
      font-weight: 600;
    }
  `;
  return style;
};

export const getInlineAnchorList: PlasmoGetInlineAnchorList = async () => {
  const anchors = document.querySelectorAll('[data-automation="jobCardLocation"]:first-of-type');
  return [...anchors].map(element => ({
    element: element?.parentElement?.parentElement?.parentElement,
    insertPosition: 'beforebegin'
  }));
};

const SeekListing = ({ anchor }: PlasmoCSUIProps) => {
  var article = anchor.element.closest('article');
  return <Seek anchor={anchor} id={article?.dataset?.jobId} />;
};

export default SeekListing;
