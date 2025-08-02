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
    const { token } = event.queryStringParameters || {};
    
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ authenticated: false, error: 'No token provided' })
      };
    }

    // Forward the request to your Render backend
    const response = await fetch(`https://videoclipper-backend.onrender.com/auth/verify-token?token=${token}`, {
      method: 'GET',
      headers: {
        'Cookie': event.headers.cookie || '',
        'Origin': event.headers.origin || '',
        'User-Agent': event.headers['user-agent'] || ''
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
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