export default {
  install(app) {
    app.provide('appColors', {
      primary: '#1a237e',
      primaryLight: '#534bae',
      primaryDark: '#000051',
      accent: '#ff6d00',
      surface: '#ffffff',
      background: '#f5f5f5',
      error: '#b00020',
      success: '#2e7d32',
      text: '#212121',
      textSecondary: '#757575'
    })
  }
}
