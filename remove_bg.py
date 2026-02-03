from PIL import Image

img = Image.open('C:/Projetos/Projeto_Rotas/speedrota/public/logo.jpg').convert('RGBA')
data = list(img.getdata())
new_data = []

for p in data:
    # Se o pixel for branco ou cinza claro (fundo), torna transparente
    if p[0] > 230 and p[1] > 230 and p[2] > 230:
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(p)

img.putdata(new_data)
img.save('C:/Projetos/Projeto_Rotas/speedrota/public/logo.png', 'PNG')
print('Logo PNG criado com fundo transparente!')
