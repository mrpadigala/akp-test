class SsmClient {
  constructor(ssm) {
    this.ssm = ssm;
  }

  get(name) {
    return this.ssm.getParameter({
      Name: name,
      WithDecryption: true,
    }).promise().then(ssmData => ssmData.Parameter.Value);
  }
}

module.exports = { SsmClient };
