import axios from 'axios';

async function exploreAPI() {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/markets', {
      params: { limit: 1, active: true, closed: false },
    });
    console.log('Raw API Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

exploreAPI();
