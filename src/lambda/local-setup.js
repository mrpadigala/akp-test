const fs = require('fs');
const prompt = require('prompt');

const npmrcFile = './.npmrc';
const schema = {
  properties: {
    token: {
      description: 'Enter Github personal token',
      required: true,
      hidden: true,
    },
  },
};

try {
  if (!fs.existsSync(npmrcFile)) {
    prompt.start();
    console.log('https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages');
    prompt.get(schema, (err, result) => {
      if (err) throw err;

      const content = `@prettylittlething:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${result.token}`;
      fs.writeFile(npmrcFile, content, 'utf8', (error) => {
        if (error) throw error;

        console.log(`The file was successfully saved! ${npmrcFile}`);
      });
    });
  }
} catch (err) {
  console.error('Install script error: ', err);
}
