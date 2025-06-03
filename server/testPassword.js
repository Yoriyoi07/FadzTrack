const bcrypt = require('bcrypt');

async function test() {
  const password = '12345678';
  const hash = await bcrypt.hash(password, 10);
  console.log('Hash:', hash);

  const match = await bcrypt.compare(password, hash);
  console.log('Password match:', match);
}

test();
