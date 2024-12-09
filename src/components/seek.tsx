import logo from 'data-base64:../../assets/logo.svg';
import type { PlasmoCSUIProps } from 'plasmo';
import { useEffect, useState, type FC } from 'react';
import { getRangeFormat } from '~common';
import { salarySeeker, seeking } from '~constants';
import { getPrice } from '~services/seekService';

interface SeekProps extends PlasmoCSUIProps {
  id?: string;
}

export const Seek: FC<SeekProps> = ({ anchor, id }) => {
  const [message, setMessage] = useState('');
  const [range, setRange] = useState('');
  const controller = new AbortController();

  useEffect(() => {
    handleJob();
  }, []);

  const handleJob = async () => {
    const { element } = anchor;
    const exists = element.querySelector('[data-automation="advertiser-name"]');

    // Handle job
    if (exists) {
      getJobPrice(window.location.href);
      return;
    }

    // Handle list job
    if (id) {
      const observer = new IntersectionObserver(async entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            getJobPrice(`${window.location.origin}/job/${id}`);
          }
        }
      });

      observer.observe(anchor.element);
    }
  };

  const getJobPrice = async (href: string) => {
    try {
      const [min, max] = await getPrice(href, controller.signal);
      console.log(min, max);
      setRange(getRangeFormat(min, max));
    } catch (error) {
      console.log(error);
      setMessage('Failed to get price 😵');
    }
  };

  return (
    <div className="container">
      <img className="logo" src={logo} alt={salarySeeker} title={salarySeeker} />
      {message && <span className="message">{message}</span>}
      {!message && <span className="price">{range ? range : seeking}</span>}
    </div>
  );
};
