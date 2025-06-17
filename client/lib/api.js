import { useAuth } from '@clerk/nextjs';

export function useSecureFetch() {
  const { getToken } = useAuth();

  const secureFetch = async (url, options = {}) => {
    const token = await getToken();

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  return secureFetch;
}
