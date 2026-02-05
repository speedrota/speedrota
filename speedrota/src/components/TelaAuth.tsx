/**
 * @fileoverview Tela de Login/Registro
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import './TelaAuth.css';

interface TelaAuthProps {
  onSuccess?: () => void;
}

type Modo = 'login' | 'registro' | 'esqueci-senha' | 'codigo' | 'nova-senha';

export function TelaAuth({ onSuccess }: TelaAuthProps) {
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState<'ENTREGADOR' | 'GESTOR_FROTA'>('ENTREGADOR');
  
  // Campos de recuperação de senha
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const { login, register, isLoading, error, clearError } = useAuthStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');
    
    let success = false;
    
    if (modo === 'login') {
      success = await login(email, senha);
    } else if (modo === 'registro') {
      success = await register({ email, senha, nome, telefone: telefone || undefined, tipoUsuario });
    }
    
    if (success && onSuccess) {
      onSuccess();
    }
  };
  
  const handleEsqueciSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError('');
    setMensagem('');
    
    try {
      const response = await authService.forgotPassword(email);
      setMensagem(response.message);
      setModo('codigo');
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao solicitar recuperação');
    } finally {
      setLocalLoading(false);
    }
  };
  
  const handleVerificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError('');
    
    try {
      await authService.verifyResetCode(email, codigo);
      setModo('nova-senha');
    } catch (err: any) {
      setLocalError(err.message || 'Código inválido ou expirado');
    } finally {
      setLocalLoading(false);
    }
  };
  
  const handleRedefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError('');
    
    if (novaSenha !== confirmarSenha) {
      setLocalError('As senhas não coincidem');
      setLocalLoading(false);
      return;
    }
    
    if (novaSenha.length < 6) {
      setLocalError('A senha deve ter no mínimo 6 caracteres');
      setLocalLoading(false);
      return;
    }
    
    try {
      const response = await authService.resetPassword(email, codigo, novaSenha);
      setMensagem(response.message);
      // Voltar para login após 2 segundos
      setTimeout(() => {
        setModo('login');
        setSenha('');
        setNovaSenha('');
        setConfirmarSenha('');
        setCodigo('');
        setMensagem('');
      }, 2000);
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao redefinir senha');
    } finally {
      setLocalLoading(false);
    }
  };
  
  const trocarModo = () => {
    setModo(modo === 'login' ? 'registro' : 'login');
    clearError();
    setLocalError('');
    setMensagem('');
  };
  
  const voltarParaLogin = () => {
    setModo('login');
    clearError();
    setLocalError('');
    setMensagem('');
    setCodigo('');
    setNovaSenha('');
    setConfirmarSenha('');
  };
  
  // Título dinâmico
  const getTitulo = () => {
    switch (modo) {
      case 'esqueci-senha': return 'Recuperar Senha';
      case 'codigo': return 'Verificar Código';
      case 'nova-senha': return 'Nova Senha';
      default: return 'Otimize suas entregas';
    }
  };
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img src="/logo.png" alt="SpeedRota" />
          <h1>SpeedRota</h1>
          <p>{getTitulo()}</p>
        </div>
        
        {/* Tabs - só mostra em login/registro */}
        {(modo === 'login' || modo === 'registro') && (
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${modo === 'login' ? 'active' : ''}`}
              onClick={() => setModo('login')}
            >
              Entrar
            </button>
            <button 
              className={`auth-tab ${modo === 'registro' ? 'active' : ''}`}
              onClick={() => setModo('registro')}
            >
              Criar Conta
            </button>
          </div>
        )}
        
        {/* Form Login/Registro */}
        {(modo === 'login' || modo === 'registro') && (
          <form onSubmit={handleSubmit} className="auth-form">
            {modo === 'registro' && (
              <div className="form-group">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  autoComplete="name"
                />
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                required
                minLength={6}
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            
            {modo === 'registro' && (
              <div className="form-group">
                <label htmlFor="telefone">Telefone (opcional)</label>
                <input
                  id="telefone"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                />
              </div>
            )}
            
            {modo === 'registro' && (
              <div className="form-group">
                <label>Você é:</label>
                <div className="tipo-usuario-selector">
                  <button
                    type="button"
                    className={`tipo-usuario-btn ${tipoUsuario === 'ENTREGADOR' ? 'active' : ''}`}
                    onClick={() => setTipoUsuario('ENTREGADOR')}
                  >
                    🚴 Entregador
                    <small>Faço minhas próprias entregas</small>
                  </button>
                  <button
                    type="button"
                    className={`tipo-usuario-btn ${tipoUsuario === 'GESTOR_FROTA' ? 'active' : ''}`}
                    onClick={() => setTipoUsuario('GESTOR_FROTA')}
                  >
                    🚚 Gestor de Frota
                    <small>Gerencio uma equipe de entregadores</small>
                  </button>
                </div>
              </div>
            )}
            
            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="auth-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner">⏳</span>
              ) : modo === 'login' ? (
                '🚀 Entrar'
              ) : (
                '✨ Criar Conta'
              )}
            </button>
            
            {modo === 'login' && (
              <button 
                type="button" 
                className="auth-forgot-link"
                onClick={() => setModo('esqueci-senha')}
              >
                Esqueci minha senha
              </button>
            )}
          </form>
        )}
        
        {/* Form Esqueci Senha */}
        {modo === 'esqueci-senha' && (
          <form onSubmit={handleEsqueciSenha} className="auth-form">
            <div className="form-group">
              <label htmlFor="email-reset">E-mail cadastrado</label>
              <input
                id="email-reset"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            
            <p className="auth-hint">
              Digite seu e-mail e enviaremos um código de recuperação.
            </p>
            
            {localError && (
              <div className="auth-error">
                <span>⚠️</span> {localError}
              </div>
            )}
            
            <button 
              type="submit" 
              className="auth-submit"
              disabled={localLoading}
            >
              {localLoading ? (
                <span className="loading-spinner">⏳</span>
              ) : (
                '📧 Enviar Código'
              )}
            </button>
            
            <button 
              type="button" 
              className="auth-back-link"
              onClick={voltarParaLogin}
            >
              ← Voltar para o login
            </button>
          </form>
        )}
        
        {/* Form Verificar Código */}
        {modo === 'codigo' && (
          <form onSubmit={handleVerificarCodigo} className="auth-form">
            <div className="form-group">
              <label htmlFor="codigo">Código de recuperação</label>
              <input
                id="codigo"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                className="auth-code-input"
                autoComplete="one-time-code"
              />
            </div>
            
            <p className="auth-hint">
              Digite o código de 6 dígitos enviado para <strong>{email}</strong>
            </p>
            
            {mensagem && (
              <div className="auth-success">
                <span>✅</span> {mensagem}
              </div>
            )}
            
            {localError && (
              <div className="auth-error">
                <span>⚠️</span> {localError}
              </div>
            )}
            
            <button 
              type="submit" 
              className="auth-submit"
              disabled={localLoading || codigo.length !== 6}
            >
              {localLoading ? (
                <span className="loading-spinner">⏳</span>
              ) : (
                '✓ Verificar Código'
              )}
            </button>
            
            <button 
              type="button" 
              className="auth-back-link"
              onClick={() => setModo('esqueci-senha')}
            >
              ← Reenviar código
            </button>
          </form>
        )}
        
        {/* Form Nova Senha */}
        {modo === 'nova-senha' && (
          <form onSubmit={handleRedefinirSenha} className="auth-form">
            <div className="form-group">
              <label htmlFor="nova-senha">Nova senha</label>
              <input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmar-senha">Confirmar nova senha</label>
              <input
                id="confirmar-senha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Digite novamente"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            
            {mensagem && (
              <div className="auth-success">
                <span>✅</span> {mensagem}
              </div>
            )}
            
            {localError && (
              <div className="auth-error">
                <span>⚠️</span> {localError}
              </div>
            )}
            
            <button 
              type="submit" 
              className="auth-submit"
              disabled={localLoading}
            >
              {localLoading ? (
                <span className="loading-spinner">⏳</span>
              ) : (
                '🔐 Redefinir Senha'
              )}
            </button>
          </form>
        )}
        
        {/* Alternar modo - só mostra em login/registro */}
        {(modo === 'login' || modo === 'registro') && (
          <div className="auth-footer">
            {modo === 'login' ? (
              <p>
                Não tem conta?{' '}
                <button type="button" onClick={trocarModo}>
                  Criar agora
                </button>
              </p>
            ) : (
              <p>
                Já tem conta?{' '}
                <button type="button" onClick={trocarModo}>
                  Fazer login
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TelaAuth;
