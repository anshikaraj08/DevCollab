// Wraps async controllers so any error is passed to the global handler
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);


// 5. Visualizing how asyncHandler works
//       Express receives a request
//                 |

// For example, GET /api/rooms/123

// asyncHandler calls the controller
//        fn(req, res, next)
//                 |

// Success
// Controller sends a response. No error is forwarded.


// Failure ->imp here
// Promise rejects. .catch(next) forwards the error.

//                  |

// Global error middleware
// Handles the error and sends the response