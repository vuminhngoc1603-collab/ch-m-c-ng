import cv2, numpy as np, sys
from PIL import Image
def solid(a, t, close=9):
    m=(a>t).astype(np.uint8)*255
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((close,close),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    big=1+np.argmax(st[1:,4]); m=(lab==big).astype(np.uint8)*255
    # chỉ lấp lỗ bên trong: lỗ không chạm biên trên/trái/phải (biên dưới là chỗ ảnh bị cắt)
    p=cv2.copyMakeBorder(m,1,0,1,1,cv2.BORDER_CONSTANT,value=0)
    ff=p.copy(); h,w=p.shape; mk=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,mk,(0,0),255)
    holes=cv2.bitwise_not(ff)[1:,1:-1]
    hs=holes.copy(); n2,l2,s2,_=cv2.connectedComponentsWithStats(hs)
    for i in range(1,n2):
        if s2[i,4]>4000: hs[l2==i]=0   # lỗ lớn = nền thật, bỏ qua
    m=m|hs
    return m
if __name__=='__main__':
    a=np.array(Image.open('cut.png'))[:,:,3]
    o=Image.open('orig.png').convert('RGB')
    sheet=Image.new('RGB',(3*400,400))
    for i,t in enumerate([60,110,160]):
        m=solid(a,t); im=o.copy(); im.putalpha(Image.fromarray(m))
        bg=Image.new('RGB',(1024,1024),(90,170,80)); bg.paste(im,(0,0),im); sheet.paste(bg.resize((400,400)),(i*400,0))
    sheet.save('thr.png')
