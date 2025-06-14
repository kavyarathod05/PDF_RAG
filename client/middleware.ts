import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/',                 // ensure `/` is matched
    '/(.*)',             // catch everything else
  ],
};
