import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function App() {
  const [currentView, setCurrentView] = useState('welcome'); // welcome, menu, chat
  const [userName, setUserName] = useState('');
  const [socket, setSocket] = useState(null);
  const [roomToken, setRoomToken] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentView === 'chat' && !socket) {
      const newSocket = io(BACKEND_URL);
      setSocket(newSocket);

      newSocket.on('roomJoined', (data) => {
        setConnectedUsers(data.users);
        setMessages(data.messages);
      });

      newSocket.on('newMessage', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('userConnected', (data) => {
        const connectMessage = {
          id: Date.now(),
          text: `${data.userName} is connected`,
          isSystem: true,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, connectMessage]);
      });

      newSocket.on('userDisconnected', (data) => {
        const disconnectMessage = {
          id: Date.now(),
          text: `${data.userName} has disconnected`,
          isSystem: true,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, disconnectMessage]);
      });

      newSocket.on('sessionExpired', () => {
        alert('Chat session has expired due to inactivity. Starting a new session...');
        setCurrentView('menu');
        setMessages([]);
        setRoomToken('');
        newSocket.disconnect();
        setSocket(null);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [currentView]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      setCurrentView('menu');
    }
  };

  const generateToken = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-token`);
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error generating token:', error);
      return null;
    }
  };

  const startNewChat = async () => {
    const token = await generateToken();
    if (token) {
      setRoomToken(token);
      setIsCreator(true);
      setCurrentView('chat');
    }
  };

  const joinChatAsReceiver = () => {
    setShowTokenModal(true);
    setTokenError('');
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      setTokenError('Please enter a token');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenInput.toUpperCase() }),
      });

      const data = await response.json();
      
      if (data.valid) {
        setRoomToken(tokenInput.toUpperCase());
        setIsCreator(false);
        setShowTokenModal(false);
        setTokenInput('');
        setCurrentView('chat');
      } else {
        setTokenError('Invalid token. Please check and try again.');
      }
    } catch (error) {
      setTokenError('Error validating token. Please try again.');
    }
  };

  const joinRoom = () => {
    if (socket && roomToken && userName) {
      socket.emit('joinRoom', {
        token: roomToken,
        userName: userName,
        isCreator: isCreator
      });
    }
  };

  useEffect(() => {
    if (currentView === 'chat' && socket && roomToken && userName) {
      joinRoom();
    }
  }, [currentView, socket, roomToken, userName]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim() && socket) {
      socket.emit('sendMessage', {
        token: roomToken,
        message: currentMessage.trim(),
        userName: userName
      });
      setCurrentMessage('');
      setShowEmojiPicker(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setCurrentMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    chatInputRef.current?.focus();
  };

  const backToMenu = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setCurrentView('menu');
    setMessages([]);
    setRoomToken('');
    setConnectedUsers([]);
  };

  const renderWelcome = () => (
    <div className="welcome-container fade-in">
      <h1 className="welcome-title">iChat</h1>
      <p className="welcome-subtitle">Connect instantly with token-based rooms</p>
      <form onSubmit={handleNameSubmit}>
        <input
          type="text"
          placeholder="Enter your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="name-input"
          maxLength="20"
          required
        />
        <button type="submit" className="btn">
          Continue
        </button>
      </form>
    </div>
  );

  const renderMenu = () => (
    <div className="menu-container fade-in">
      <h2 className="menu-title">Welcome!</h2>
      <p className="user-name">Hello, {userName}</p>
      <div className="menu-buttons">
        <button className="btn" onClick={startNewChat}>
          Start New Chat
        </button>
        <button className="btn btn-secondary" onClick={joinChatAsReceiver}>
          Join Chat
        </button>
      </div>
    </div>
  );

  const renderTokenModal = () => (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Enter Chat Token</h3>
        <input
          type="text"
          placeholder="Enter 6-character token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
          maxLength="6"
        />
        {tokenError && <div className="error-message">{tokenError}</div>}
        <div className="modal-buttons">
          <button 
            className="btn btn-cancel" 
            onClick={() => {
              setShowTokenModal(false);
              setTokenInput('');
              setTokenError('');
            }}
          >
            Cancel
          </button>
          <button className="btn btn-join" onClick={handleTokenSubmit}>
            Join Chat
          </button>
        </div>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="chat-container fade-in">
      <div className="chat-header">
        <h2>iChat Room</h2>
        <div className="room-token">Room: {roomToken}</div>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            {message.isSystem ? (
              <div className="system-message">{message.text}</div>
            ) : (
              <>
                <div className="message-sender">{message.userName}</div>
                <div className="message-content">{message.text}</div>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-input-container">
        <input
          ref={chatInputRef}
          type="text"
          placeholder="Type your message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          className="chat-input"
          maxLength="500"
        />
        <button
          type="button"
          className="emoji-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          😊
        </button>
        <button type="submit" className="btn send-btn">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="16" 
            height="16"
            fill="currentColor"
          >
            <path d="m.172,3.708C-.216,2.646.076,1.47.917.713,1.756-.041,2.951-.211,3.965.282l18.09,8.444c.97.454,1.664,1.283,1.945,2.273H4.048L.229,3.835c-.021-.041-.04-.084-.057-.127Zm3.89,9.292L.309,20.175c-.021.04-.039.08-.054.122-.387,1.063-.092,2.237.749,2.993.521.467,1.179.708,1.841.708.409,0,.819-.092,1.201-.279l18.011-8.438c.973-.456,1.666-1.288,1.945-2.28H4.062Z"/>
          </svg>
        </button>
      </form>

      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </div>
      )}

      <button 
        onClick={backToMenu}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}
      >
        ← Back
      </button>
    </div>
  );

  return (
    <div className="app">
      {currentView === 'welcome' && renderWelcome()}
      {currentView === 'menu' && renderMenu()}
      {currentView === 'chat' && renderChat()}
      {showTokenModal && renderTokenModal()}
    </div>
  );
}

export default App;
