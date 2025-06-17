export const requireAuth = async (req, res, next) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const session = await clerk.sessions.verifySession(sessionToken);
    req.auth = { userId: session.userId };  // Attach user ID to request
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid session' });
  }
};