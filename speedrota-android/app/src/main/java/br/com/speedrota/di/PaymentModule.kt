package br.com.speedrota.di

import br.com.speedrota.data.payment.MercadoPagoTokenizer
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import javax.inject.Singleton

/**
 * Módulo de injeção de dependências para Pagamentos
 */
@Module
@InstallIn(SingletonComponent::class)
object PaymentModule {
    
    @Provides
    @Singleton
    fun provideMercadoPagoTokenizer(
        okHttpClient: OkHttpClient
    ): MercadoPagoTokenizer {
        return MercadoPagoTokenizer(okHttpClient)
    }
}
