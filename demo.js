let apiClient;

function displayAuthError(error) {
  $('#auth-error').html(error);

  $('#submit-login').prop('disabled', false);
}

function authenticate(username, password, server) {
  apiClient = new window['@wazo/sdk'].WazoApiClient({server});

  apiClient.auth.logIn({
      username: username,
      password: password,
      backend: 'xivo_user',
      expiration: 48 * 60 * 60
    }).then(function (data) {
    const userToken = data.token;

    apiClient.confd.getUser(userToken, data.uuid).then(function (user) {
      $('#name').html(user.firstName ? user.firstName + ' ' + user.lastName : username);
      $.each(user.lines, function(key, value) {
          apiClient.confd.getUserLineSip(data.token, data.uuid, user.lines[key].id).then(function (sipLine) {
          	if (sipLine.username.indexOf("w") >= 0){
          		initializeWebRtc(sipLine, server);
                onLogin();
          	}
           }).catch(displayAuthError);    	  
      });
    }).catch(displayAuthError);
  }).catch(displayAuthError);
}

function initializeWebRtc(sipLine, server) {
	console.log("initializeWebRtc");
  webRtcClient = new window['@wazo/sdk'].WazoWebRTCClient({
    wsServers: ['wss://' + server + '/api/asterisk/ws'],
    displayName: 'SaBRO Communications Hub',
    authorizationUser: sipLine.username,
    password: sipLine.secret,
    uri: sipLine.username + '@' + server,
    media: {
      audio: document.getElementById('audio')
    }
  });
  console.log(webRtcClient);
  console.log(sipLine.username);
  console.log(sipLine.secret);
  console.log(server);
  console.log(document.getElementById('audio'));

  webRtcClient.on('ringing', openIncomingCallModal);
  webRtcClient.on('connected', onCallAccepted);
  webRtcClient.on('ended', function () {
    resetDialer('Call ended');
  });
}

function openLoginModal() {
  $('#login-modal').modal({backdrop: 'static'});

  $('#login-form').on('submit', function (e) {
    e.preventDefault();

    $('#submit-login').prop('disabled', true);
    authenticate($('#username').val(), $('#password').val(), $('#server').val());
  });
}

function onLogin() {
  const dialer = $('#dialer');
  $('#submit-login').prop('disabled', false);
  $('#login-modal').modal('hide');
  $('#hangup').hide();
  dialer.show();

  dialer.on('submit', function (e) {
    e.preventDefault();

    const number = $('#number').val();
    webRtcClient.call(number);
    $('#status').html('Calling ' + number + '...');
  })
}

function resetDialer(status) {
  $('#hangup').hide();
  $('#number').val('');
  $('#status').html(status);
}

function onCallAccepted() {
  $('#status').html('In call...');

  const button = $('#hangup');
  button.show();
  button.on('click', function (e) {
    e.preventDefault();
    webRtcClient.hangup();
    resetDialer('');
  });
}

function openIncomingCallModal(session) {
  const number = session.remoteIdentity.uri._normal.user;

  $('#incoming-modal').modal({backdrop: 'static'});
  $('#incoming-modal h5 span').html(number);

  $('#accept').on('click', function () {
    webRtcClient.answer(session);
    $('#incoming-modal').modal('hide');
    onCallAccepted();
  });
  $('#reject').on('click', function () {
    webRtcClient.reject(session);
    $('#incoming-modal').modal('hide');
  });
}

$(window).on('load', openLoginModal);