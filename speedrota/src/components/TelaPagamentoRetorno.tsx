/**
 * @fileoverview Tela de Retorno do Pagamento
 */

import { useEffect, useState } from 'react';
import { pagamentoService } from '../services/pagamentos';
import { useAuthStore } from '../store/authStore';
import './TelaPagamentoRetorno.css';

type StatusPagamento = 'sucesso' | 'erro' | 'pendente' | 'carregando';

interface TelaPagamentoRetornoProps {
  status: 'sucesso' | 'erro' | 'pendente';
  onVoltar: () => void;
}

export function TelaPagamentoRetorno({ status: statusInicial, onVoltar }: TelaPagamentoRetornoProps) {
  const [status, setStatus] = useState<StatusPagamento>(statusInicial === 'sucesso' ? 'carregando' : statusInicial);
  const [mensagem, setMensagem] = useState('');
  const { loadUser } = useAuthStore();
  
  useEffect(() => {
    if (statusInicial === 'sucesso') {
      confirmarUpgrade();
    }
  }, []);
  
  const confirmarUpgrade = async () => {
    // Pegar parâmetros da URL
    const params = new URLSearchParams(window.location.search);
    const plano = params.get('plano');
    const paymentId = params.get('payment_id') || params.get('collection_id');
    
    if (!plano) {
      setStatus('erro');
      setMensagem('Plano não identificado');
      return;
    }
    
    try {
      const resultado = await pagamentoService.confirmarUpgrade(plano, paymentId || undefined);
      setMensagem(resultado.mensagem);
      setStatus('sucesso');
      
      // Atualizar dados do usuário
      await loadUser();
    } catch (error: any) {
      setStatus('pendente');
      setMensagem(error.message || 'Pagamento em processamento. Tente novamente em alguns minutos.');
    }
  };
  
  const getIcon = () => {
    switch (status) {
      case 'sucesso':
        return '🎉';
      case 'erro':
        return '❌';
      case 'pendente':
        return '⏳';
      case 'carregando':
        return '🔄';
    }
  };
  
  const getTitulo = () => {
    switch (status) {
      case 'sucesso':
        return 'Pagamento Aprovado!';
      case 'erro':
        return 'Pagamento não aprovado';
      case 'pendente':
        return 'Pagamento Pendente';
      case 'carregando':
        return 'Confirmando pagamento...';
    }
  };
  
  const getDescricao = () => {
    if (mensagem) return mensagem;
    
    switch (status) {
      case 'sucesso':
        return 'Seu plano foi atualizado com sucesso. Aproveite todos os recursos!';
      case 'erro':
        return 'Houve um problema com seu pagamento. Por favor, tente novamente.';
      case 'pendente':
        return 'Seu pagamento está sendo processado. Você receberá uma notificação quando for aprovado.';
      case 'carregando':
        return 'Aguarde enquanto confirmamos seu pagamento...';
    }
  };
  
  return (
    <div className="pagamento-retorno">
      <div className="retorno-card">
        <div className={`retorno-icon ${status}`}>
          {getIcon()}
        </div>
        
        <h1 className="retorno-titulo">{getTitulo()}</h1>
        <p className="retorno-descricao">{getDescricao()}</p>
        
        {status !== 'carregando' && (
          <button className="retorno-btn" onClick={onVoltar}>
            {status === 'sucesso' ? '🚀 Começar a usar' : '← Voltar'}
          </button>
        )}
        
        {status === 'pendente' && (
          <button 
            className="retorno-btn-secundario" 
            onClick={confirmarUpgrade}
          >
            🔄 Verificar novamente
          </button>
        )}
      </div>
    </div>
  );
}

export default TelaPagamentoRetorno;
