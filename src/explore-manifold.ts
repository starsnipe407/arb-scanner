import axios from 'axios';

/**
 * Explore Manifold Markets API structure
 * Docs: https://docs.manifold.markets/api
 */
async function exploreManifoldAPI() {
  try {
    console.log('📡 Fetching from Manifold Markets API...\n');
    
    // Manifold API endpoint for markets
    const response = await axios.get('https://api.manifold.markets/v0/markets', {
      params: {
        limit: 2, // Just get 2 markets to see structure
      },
    });

    console.log('Raw API Response (first 2 markets):\n');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

exploreManifoldAPI();
