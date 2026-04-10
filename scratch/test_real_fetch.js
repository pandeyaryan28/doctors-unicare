async function testFetch() {
  const url = 'https://unicare.space/api/share/packet/cbe5bc29-2e5f-41eb-8e7a-135fb3cbace3';
  console.log(`Fetching ${url}...`);
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Data:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Error Body:', text);
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testFetch();
