const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': 'https://viralclipper.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Forward the request to your Render backend
    const response = await fetch('https://videoclipper-backend.onrender.com/auth/logout', {
      method: 'GET',
      headers: {
        'Cookie': event.headers.cookie || '',
        'Origin': event.headers.origin || '',
        'User-Agent': event.headers['user-agent'] || ''
      }
    });

    // Return the response from the backend
    return {
      statusCode: response.status,
      headers,
      body: await response.text()
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 