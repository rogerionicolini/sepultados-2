import os

# Caminho da pasta onde estão as imagens
pasta = r'D:\Projeto\media\brasoes'  # ajuste aqui se necessário

# Extensões que vamos tratar (maiúsculas)
extensoes_alvo = ['.JPG', '.JPEG', '.PNG']

# Contador para exibir o resumo
renomeados = 0

# Loop pelos arquivos da pasta
for nome_arquivo in os.listdir(pasta):
    nome_completo = os.path.join(pasta, nome_arquivo)
    nome_base, extensao = os.path.splitext(nome_arquivo)

    if extensao.upper() in extensoes_alvo:
        nova_extensao = extensao.lower()
        novo_nome = f"{nome_base}{nova_extensao}"
        novo_caminho = os.path.join(pasta, novo_nome)

        if nome_arquivo != novo_nome:
            os.rename(nome_completo, novo_caminho)
            print(f"Renomeado: {nome_arquivo} -> {novo_nome}")
            renomeados += 1

print(f"\nTotal de arquivos renomeados: {renomeados}")
