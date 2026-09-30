# Classificador de folhas de batata

Este protótipo acadêmico usa o modelo entregue em `keras_model.h5` para classificar imagens de folhas de batata como **saudáveis** ou **doentes**. A execução processa uma pasta e suas subpastas, mostra um resumo no terminal e gera o arquivo estruturado `resultados.csv`.

## Arquivos principais

```text
agrosmart/
├── keras_model.h5
├── labels.txt
├── requirements.txt
├── script.py
├── imagens_Teste/
│   ├── Potato___healthy/
│   └── Potato___Late_blight/
└── resultados.csv
```

As subpastas entregues representam categorias conhecidas:

| Pasta | Categoria esperada |
| --- | --- |
| `Potato___healthy` | Folha saudável |
| `Potato___Late_blight` | Folha doente |

Quando uma imagem está em uma dessas pastas, o CSV também registra a categoria esperada e se a previsão acertou. Imagens em outras pastas ainda podem ser classificadas, mas não entram no cálculo de acurácia por não terem uma categoria esperada conhecida pelo script.

## Ambiente verificado

- Python 3.9
- TensorFlow 2.13.1
- NumPy 1.24.3
- Pillow 10.4.0

## Como executar

Abra o terminal na pasta `agrosmart` e crie um ambiente virtual limpo:

```bash
python3.9 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

No Windows, ative o ambiente com:

```powershell
.venv\Scripts\activate
```

Para processar as duas classes entregues e gerar o CSV:

```bash
python script.py imagens_Teste --output resultados.csv
```

O caminho da pasta de imagens e o nome do arquivo de saída podem ser alterados sem editar o código:

```bash
python script.py caminho/para/imagens --output outro_resultado.csv
```

O modelo e o arquivo `labels.txt` são localizados automaticamente na mesma pasta de `script.py`.

## Resultado da execução verificada

A execução sobre as 200 imagens entregues produziu:

- 200 imagens processadas;
- 199 acertos e 1 erro;
- acurácia de 99,5% no conjunto de teste fornecido pelo dataset, em condições controladas.

Esse resultado não representa validação em campo ou garantia de desempenho em outras condições de fundo, iluminação e enquadramento.

## Formato do CSV

Cada linha contém:

- `nome_imagem`: nome do arquivo;
- `caminho_relativo`: localização da imagem dentro da pasta informada;
- `categoria_detectada`: categoria prevista pelo modelo;
- `confianca`: confiança da previsão, entre 0 e 1;
- `categoria_esperada`: categoria indicada pela pasta, quando conhecida;
- `acertou`: `sim` ou `não`, quando existe categoria esperada.

Exemplo:

```csv
nome_imagem,caminho_relativo,categoria_detectada,confianca,categoria_esperada,acertou
Potato_healthy-42-_0_2949.jpg,Potato___healthy/Potato_healthy-42-_0_2949.jpg,Folha saudável,1.000000,Folha saudável,sim
```

A confiança indica o grau de certeza do modelo para uma previsão individual. A acurácia é calculada apenas quando as imagens estão em pastas de categoria conhecida.
