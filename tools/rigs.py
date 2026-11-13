# Cấu hình tách lớp cho từng con giáp (toạ độ trên ảnh gốc 696×696).
# role: head | leg | tail | arm | wing ; phase: A/B (bước luân phiên)
# z: back (sau thân) | front (trước thân)
# clear: xoá phần đó khỏi lớp thân theo nửa mặt phẳng {"y_gt": Y} / {"y_lt": Y} / {"x_lt": X} / {"x_gt": X} / "all"
# fill: tô lấp lớp thân phía sau bộ phận (dùng cho bộ phận nằm trước thân)
P = lambda *pts: list(pts)

RIGS = {
  "ty": [
    dict(name="legL", role="leg", phase="A", z="back", poly=P((195,560),(300,560),(300,655),(195,655)), pivot=(250,565), clear={"y_gt": 600}),
    dict(name="legR", role="leg", phase="B", z="back", poly=P((330,560),(445,560),(445,658),(330,658)), pivot=(390,565), clear={"y_gt": 600}),
    dict(name="head", role="head", z="front", poly=P((85,35),(648,35),(648,330),(510,375),(200,375),(85,300)), pivot=(360,375), clear={"y_lt": 320}),
    dict(name="armL", role="arm", phase="A", z="front", poly=P((132,435),(222,428),(230,507),(160,515),(128,482)), pivot=(215,445), fill=True),
    dict(name="armR", role="arm", phase="B", z="front", poly=P((335,450),(447,448),(452,537),(338,542)), pivot=(420,455), fill=True),
  ],
  "suu": [
    dict(name="legBL", role="leg", phase="B", z="back", poly=P((425,505),(497,505),(497,638),(425,638)), pivot=(460,510), clear={"y_gt": 545}),
    dict(name="legBR", role="leg", phase="A", z="back", poly=P((513,488),(603,488),(603,648),(513,648)), pivot=(560,495), clear={"y_gt": 535}),
    dict(name="legFL", role="leg", phase="A", z="back", poly=P((220,505),(307,505),(312,676),(220,676)), pivot=(262,510), clear={"y_gt": 545}),
    dict(name="legFR", role="leg", phase="B", z="back", poly=P((333,512),(427,512),(427,678),(333,678)), pivot=(380,517), clear={"y_gt": 550}),
    dict(name="tail", role="tail", z="back", poly=P((583,393),(638,393),(638,498),(583,498)), pivot=(598,400), clear="all"),
    dict(name="head", role="head", z="front", poly=P((68,20),(462,20),(462,200),(340,302),(200,322),(72,222)), pivot=(270,300), clear={"y_lt": 250}),
  ],
  "dan": [
    dict(name="pawL", role="leg", phase="A", z="back", poly=P((146,588),(277,588),(287,696),(146,696)), pivot=(215,595), clear={"y_gt": 615}),
    dict(name="pawR", role="leg", phase="B", z="back", poly=P((283,603),(397,603),(397,696),(283,696)), pivot=(340,610), clear={"y_gt": 628}),
    dict(name="head", role="head", z="front", poly=P((108,10),(598,10),(572,338),(300,358),(122,302)), pivot=(330,345), clear={"y_lt": 300}),
  ],
  "mao": [
    dict(name="pawF", role="leg", phase="A", z="back", poly=P((203,598),(278,598),(278,654),(203,654)), pivot=(240,600), clear={"y_gt": 612}),
    dict(name="pawB", role="leg", phase="B", z="back", poly=P((343,583),(472,583),(472,654),(343,654)), pivot=(400,590), clear={"y_gt": 615}),
    dict(name="head", role="head", z="front", poly=P((98,55),(447,55),(447,250),(402,420),(300,462),(150,462),(108,380)), pivot=(260,450), clear={"y_lt": 380}),
  ],
  "ti": [
    dict(name="tailL", role="tail", z="back", poly=P((143,448),(202,448),(202,562),(143,562)), pivot=(195,540), clear={"x_lt": 195}),
    dict(name="head", role="head", z="front", poly=P((193,50),(502,50),(502,290),(400,312),(300,312),(193,282)), pivot=(345,300), clear={"y_lt": 260}),
    dict(name="tailR", role="tail", z="front", poly=P((423,478),(567,478),(567,602),(470,612),(423,562)), pivot=(440,560), fill=True),
  ],
  "ngo": [
    dict(name="tail", role="tail", z="back", poly=P((62,335),(252,335),(252,645),(66,645)), pivot=(240,400), clear={"x_lt": 200}),
    dict(name="legBL", role="leg", phase="B", z="back", poly=P((196,553),(270,553),(270,658),(196,658)), pivot=(232,558), clear={"y_gt": 580}),
    dict(name="legBR", role="leg", phase="A", z="back", poly=P((273,558),(342,558),(342,643),(273,643)), pivot=(305,563), clear={"y_gt": 585}),
    dict(name="legFL", role="leg", phase="A", z="back", poly=P((333,573),(422,573),(422,692),(333,692)), pivot=(378,578), clear={"y_gt": 600}),
    dict(name="legFR", role="leg", phase="B", z="back", poly=P((418,563),(482,563),(482,652),(418,652)), pivot=(450,568), clear={"y_gt": 590}),
    dict(name="head", role="head", z="front", poly=P((208,5),(582,5),(582,382),(430,402),(300,402),(213,332)), pivot=(380,390), clear={"y_lt": 330}),
  ],
  "mui": [
    dict(name="legL", role="leg", phase="A", z="back", poly=P((193,622),(252,622),(252,670),(193,670)), pivot=(222,625), clear={"y_gt": 632}),
    dict(name="legM", role="leg", phase="B", z="back", poly=P((283,627),(347,627),(347,674),(283,674)), pivot=(315,630), clear={"y_gt": 637}),
    dict(name="legR", role="leg", phase="A", z="back", poly=P((383,622),(447,622),(447,670),(383,670)), pivot=(415,625), clear={"y_gt": 632}),
    dict(name="head", role="head", z="front", poly=P((103,45),(588,45),(588,330),(480,402),(250,402),(103,302)), pivot=(350,395), clear={"y_lt": 330}),
  ],
  "than": [
    dict(name="tail", role="tail", z="back", poly=P((528,518),(648,518),(648,642),(528,642)), pivot=(535,600), clear={"x_gt": 522}),
    dict(name="footL", role="leg", phase="A", z="back", poly=P((253,613),(337,613),(337,668),(253,668)), pivot=(295,618), clear={"y_gt": 627}),
    dict(name="footR", role="leg", phase="B", z="back", poly=P((368,613),(447,613),(447,668),(368,668)), pivot=(408,618), clear={"y_gt": 627}),
    dict(name="head", role="head", z="front", poly=P((93,35),(602,35),(602,362),(420,422),(280,422),(93,352)), pivot=(350,415), clear={"y_lt": 370}),
    dict(name="hands", role="arm", phase="A", z="front", poly=P((293,493),(402,493),(402,592),(293,592)), pivot=(348,500), fill=True),
  ],
  "dau": [
    dict(name="tail", role="tail", z="back", poly=P((48,308),(228,308),(228,602),(128,602),(48,422)), pivot=(220,450), clear={"x_lt": 212}),
    dict(name="legL", role="leg", phase="A", z="back", poly=P((248,558),(367,558),(367,648),(248,648)), pivot=(280,563), clear={"y_gt": 572}),
    dict(name="legR", role="leg", phase="B", z="back", poly=P((373,563),(457,563),(457,648),(373,648)), pivot=(395,568), clear={"y_gt": 575}),
    dict(name="head", role="head", z="front", poly=P((203,35),(557,35),(557,332),(400,347),(260,342),(203,302)), pivot=(380,340), clear={"y_lt": 300}),
  ],
  "tuat": [
    dict(name="tail", role="tail", z="back", poly=P((78,468),(167,468),(167,562),(78,562)), pivot=(160,515), clear={"x_lt": 150}),
    dict(name="pawL", role="leg", phase="A", z="back", poly=P((283,613),(392,613),(392,672),(283,672)), pivot=(335,615), clear={"y_gt": 625}),
    dict(name="pawR", role="leg", phase="B", z="back", poly=P((398,603),(497,603),(497,652),(398,652)), pivot=(445,605), clear={"y_gt": 615}),
    dict(name="head", role="head", z="front", poly=P((148,25),(612,25),(602,382),(450,422),(250,422),(148,332)), pivot=(380,410), clear={"y_lt": 360}),
  ],
  "hoi": [
    dict(name="legL", role="leg", phase="A", z="back", poly=P((193,608),(247,608),(247,642),(193,642)), pivot=(220,610), clear={"y_gt": 616}),
    dict(name="legM", role="leg", phase="B", z="back", poly=P((318,603),(382,603),(382,652),(318,652)), pivot=(350,605), clear={"y_gt": 612}),
    dict(name="legR", role="leg", phase="A", z="back", poly=P((468,593),(522,593),(522,642),(468,642)), pivot=(495,595), clear={"y_gt": 603}),
    dict(name="head", role="head", z="front", poly=P((143,20),(602,20),(602,422),(450,442),(250,442),(143,382)), pivot=(370,430), clear={"y_lt": 390}),
  ],
}
