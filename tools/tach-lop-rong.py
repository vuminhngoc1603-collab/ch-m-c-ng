import cv2, numpy as np, json
from PIL import Image
from mask import solid
o=np.array(Image.open('orig.png').convert('RGB'))
a=np.array(Image.open('cut.png'))[:,:,3]
S=solid(a,60)
S[960:,:]=0  # cắt sát mép dưới để gắn chân vẽ thêm
S=cv2.GaussianBlur(S,(3,3),0)
H,W=S.shape
def poly(pts):
    m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(pts,np.int32)],255); return m
P={
 'wing': poly([(15,560),(60,450),(170,335),(230,420),(330,465),(395,470),(405,520),(385,600),(345,700),(290,765),(200,765),(110,720),(20,680)]),
 'head': poly([(130,250),(220,140),(320,0),(710,0),(710,380),(665,450),(560,478),(470,488),(400,482),(330,472),(255,440),(195,350)]),
 'bouquet': poly([(505,520),(555,468),(650,452),(765,465),(835,478),(835,565),(805,645),(760,705),(705,765),(675,835),(625,835),(598,760),(560,732),(468,724),(455,684),(497,640),(503,580)]),
 'tail': poly([(40,820),(150,730),(260,715),(340,760),(360,830),(340,960),(0,960),(0,880)]),
}
out={}
for k,m in P.items():
    mm=cv2.GaussianBlur(m,(5,5),0)
    al=(S.astype(np.float32)*mm/255).astype(np.uint8)
    ys,xs=np.where(al>0); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    Image.fromarray(np.dstack([o,al])[y0:y1,x0:x1]).save(f'{k}.png')
    out[k]=dict(x=int(x0),y=int(y0),w=int(x1-x0),h=int(y1-y0))
# Nền: lấp chỗ trống phía sau bó hoa, đầu (phần cổ), đuôi
torso=poly([(330,440),(560,440),(690,520),(700,700),(690,960),(330,960),(300,800),(330,600)])
fill=cv2.dilate(P['bouquet']|P['tail']|(P['head']&poly([(300,380),(720,380),(720,520),(300,520)])),np.ones((15,15),np.uint8))
src=o.copy()
avg=o[(torso>0)&(fill==0)&(S>200)].mean(axis=0)
src[(torso==0)]=avg   # tránh màu nền/hoa/con dấu loang vào chỗ lấp
base=cv2.inpaint(src,fill,15,cv2.INPAINT_TELEA)
sm=cv2.GaussianBlur(base,(31,31),0)
base[fill>0]=sm[fill>0]
base[fill==0]=o[fill==0]
ba=S.copy()
ba[(P['bouquet']>0)&(torso==0)]=0
ba[(P['wing']>0)&(np.arange(W)[None,:]<345)]=0         # sau cánh là nền trống
ba[(P['head']>0)&(np.arange(H)[:,None]<400)]=0          # phần đầu phía trên
ba[(P['tail']>0)&(np.arange(W)[None,:]<300)]=0
ba[:, :300]=0
Image.fromarray(np.dstack([base,ba])).save('body.png')
out['body']=dict(x=0,y=0,w=W,h=960)
json.dump(out,open('layout.json','w'))
print(out)
# xem nền đã lấp
v=Image.new('RGB',(W,H),(90,170,80)); b=Image.open('body.png'); v.paste(b,(0,0),b); v.resize((512,512)).save('body_view.png')
