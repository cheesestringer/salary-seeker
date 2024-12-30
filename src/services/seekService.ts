import { buggerAllChange, getMiddle, isDevelopment, roundDown, roundUp } from '~common';
import { maxRequests, newZealandQuerySiteKey, newZealandQueryWhere, seekNewZealand } from '~constants';

const searchUrl = `${window.location.origin}/api/jobsearch/v5/search`;

const searchJob = async (jobId: string, min: number, max: number, params: URLSearchParams, signal: AbortSignal) => {
  const url = new URL(searchUrl);
  params.forEach((value, key) => url.searchParams.set(key, value));
  url.searchParams.set('salaryrange', `${min}-${max}`);
  url.searchParams.set('pagesize', '50');
  url.searchParams.set('sourcesystem', 'houston');
  url.searchParams.set('source', 'salary-seeker');

  const response = await fetch(url.href, {
    signal: signal
  });

  if (response.ok) {
    const result = await response.json();
    if (result && result.data && result.data.find(x => x.id == jobId)) {
      return { found: true };
    } else {
      return { found: false };
    }
  } else {
    throw new Error(`Unsuccessful response: ${response.status}`);
  }
};

const getJobDetails = async (jobId: string) => {
  const url = new URL(searchUrl);
  url.searchParams.set('jobid', jobId);
  url.searchParams.set('source', 'salary-seeker');

  if (url.hostname.toLocaleLowerCase().includes(seekNewZealand)) {
    url.searchParams.set('siteKey', newZealandQuerySiteKey);
    url.searchParams.set('where', newZealandQueryWhere);
  }

  const response = await fetch(url.href);
  return response.json();
};

const getJobId = (href: string) => {
  try {
    const url = new URL(href);
    // Embedded jobs use query params while jobs opened in new tabs use rest format
    const jobId = url.searchParams.get('jobId');
    return jobId ?? url.pathname.split('/')[2];
  } catch {
    throw new Error(`Failed to find jobId for url ${href}.`);
  }
};

export const getPrice = async (href: string, signal: AbortSignal): Promise<readonly [number, number]> => {
  const jobId = getJobId(href);
  if (!jobId) {
    return null;
  }

  const minRange = 0;
  const maxRange = 1_000_000;

  const jobDetails = await getJobDetails(jobId);
  const job = jobDetails.data.find(x => x.id == jobId);
  if (isDevelopment()) {
    console.log(job);
  }

  if (job) {
    const params = new URLSearchParams();
    if (job.advertiser.id) {
      params.set('advertiserid', job.advertiser.id);
    } else {
      params.set('keywords', job.title);
    }

    if (href.toLocaleLowerCase().includes(seekNewZealand)) {
      params.set('siteKey', newZealandQuerySiteKey);
      params.set('where', newZealandQueryWhere);
    }

    const maxSalary = await getMaxSalary(jobId, minRange, maxRange, params, signal);
    const minSalary = await getMinSalary(jobId, minRange, maxSalary, params, signal);

    if (minSalary >= 0 && maxSalary >= 0) {
      // cacheJob(jobId, job.title, job.companyName, minSalary, maxSalary, range);
      return [minSalary, maxSalary];
    }
  } else {
    throw new Error(`Failed to find job ${jobId}.`);
  }
};

const getMaxSalary = async (jobId: string, min: number, max: number, params: URLSearchParams, signal: AbortSignal) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit number of requests
  for (let i = 0; i < maxRequests; i++) {
    console.log(searchValue, minimum, maximum);
    const job = await searchJob(jobId, searchValue, maximum, params, signal);
    if (job && job.found) {
      minimum = searchValue;
      searchValue = getMiddle(searchValue, maximum);

      // Check percentage change and round up to the nearest 1k to save on requests.
      if (buggerAllChange(minimum, searchValue)) {
        if (isDevelopment()) {
          console.log(`Job found: Max range ${minimum}-${searchValue} found after ${i + 1} requests.`);
        }
        return roundUp(searchValue);
      }
    } else {
      maximum = searchValue;
      searchValue = getMiddle(minimum, searchValue);

      // Check percentage change and round up to the nearest 1k to save on requests.
      if (buggerAllChange(searchValue, maximum)) {
        if (isDevelopment()) {
          console.log(`Job missing: Max range ${searchValue}-${maximum} found after ${i + 1} requests.`);
        }
        return roundUp(searchValue);
      }
    }
  }

  if (isDevelopment()) {
    console.log(`Max salary not found after ${maxRequests} requests.`);
  }

  return roundUp(searchValue);
};

const getMinSalary = async (jobId: string, min: number, max: number, params: URLSearchParams, signal: AbortSignal) => {
  let minimum = min;
  let maximum = max;
  let searchValue = getMiddle(minimum, maximum);

  // Limit number of requests
  for (let i = 0; i < maxRequests; i++) {
    const job = await searchJob(jobId, minimum, searchValue, params, signal);
    if (job && job.found) {
      maximum = searchValue;
      searchValue = getMiddle(minimum, searchValue);

      // Check percentage change and round down to the nearest 1k to save on requests.
      if (buggerAllChange(searchValue, maximum)) {
        if (isDevelopment()) {
          console.log(`Job found: Min ${searchValue}-${maximum} found after ${i + 1} requests.`);
        }
        return roundDown(searchValue);
      }
    } else {
      minimum = searchValue;
      searchValue = getMiddle(searchValue, maximum);

      // Check percentage change and round down to the nearest 1k to save on requests.
      if (buggerAllChange(minimum, searchValue)) {
        if (isDevelopment()) {
          console.log(`Job missing: Min ${minimum}-${searchValue} found after ${i + 1} requests.`);
        }
        return roundDown(searchValue);
      }
    }
  }

  if (isDevelopment()) {
    console.log(`Min salary not found after ${maxRequests} requests.`);
    console.log(searchValue);
  }
  return roundDown(searchValue);
};
