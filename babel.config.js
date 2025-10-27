module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Puedes tener otros plugins aquí (si los usas)
      
      // ⬇️ Este SIEMPRE debe ir de último:
      'react-native-worklets/plugin'
    ],
  };
};
