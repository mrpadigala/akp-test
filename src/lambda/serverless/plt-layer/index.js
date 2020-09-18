module.exports = {
  OMS: {
    Order: {
      getById: () => {
        return require('./data/mock-order.json');
      },
      runUpdateOrder: (orderId, entityType, data) => {
        console.log('plt-layer: OMS.Order.runUpdateOrder:', orderId, entityType, data);
      },
    },
    Log: {
      add: (orderId, data) => {
        console.log('plt-layer: OMS.Order.Log:', orderId, data);
      },
    },
  },
};
